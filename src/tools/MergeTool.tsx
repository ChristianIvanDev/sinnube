import { useState } from 'react';
import { FileDrop, type DroppedFile } from '../components/FileDrop';
import { toast } from '../components/Toaster';
import { downloadBlob } from '../lib/download';
import { formatBytes } from '../lib/format';
import { countPages, mergePdfs, PdfError } from '../lib/pdf';

interface Item extends DroppedFile {
  pages: number | null;
  error?: string;
}

export function MergeTool() {
  const [items, setItems] = useState<Item[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const add = (files: DroppedFile[]) => {
    const fresh = files.map((f) => ({ ...f, pages: null }));
    setItems((xs) => [...xs, ...fresh]);
    fresh.forEach(async (f) => {
      try {
        const pages = await countPages(await f.file.arrayBuffer(), f.file.name);
        setItems((xs) => xs.map((x) => (x.id === f.id ? { ...x, pages } : x)));
      } catch (err) {
        const error = err instanceof PdfError ? err.message : 'No se pudo leer.';
        setItems((xs) => xs.map((x) => (x.id === f.id ? { ...x, error } : x)));
      }
    });
  };

  const move = (id: string, delta: number) =>
    setItems((xs) => {
      const i = xs.findIndex((x) => x.id === id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= xs.length) return xs;
      const next = [...xs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const dropOn = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    setItems((xs) => {
      const from = xs.findIndex((x) => x.id === dragId);
      const to = xs.findIndex((x) => x.id === targetId);
      const next = [...xs];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const valid = items.filter((x) => !x.error);
  const totalPages = valid.reduce((n, x) => n + (x.pages ?? 0), 0);
  const ready = valid.length >= 2 && valid.every((x) => x.pages !== null) && !busy;

  const merge = async () => {
    setBusy('Leyendo archivos…');
    try {
      const inputs = await Promise.all(valid.map(async (x) => ({ name: x.file.name, data: await x.file.arrayBuffer() })));
      const bytes = await mergePdfs(inputs, (done, total) => setBusy(`Uniendo ${done} de ${total}…`));
      downloadBlob(bytes, 'unido.pdf', 'application/pdf');
      toast(`Listo: ${totalPages} páginas en un PDF de ${formatBytes(bytes.byteLength)}`);
    } catch (err) {
      toast(err instanceof PdfError ? err.message : 'Algo salió mal al unir los archivos.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="tool">
      <FileDrop
        accept={['pdf']}
        label="Suelta aquí tus PDF"
        hint="O elígelos desde tu equipo"
        onFiles={add}
        onRejected={(names) => toast(`No son PDF: ${names.join(', ')}`)}
      />

      {items.length > 0 && (
        <section className="card file-list" aria-label="Archivos a unir">
          <div className="file-list-head">
            <strong>
              {valid.length} {valid.length === 1 ? 'archivo' : 'archivos'} · {totalPages} páginas
            </strong>
            <span className="muted">Arrastra para cambiar el orden</span>
          </div>
          <ol>
            {items.map((x, i) => (
              <li
                key={x.id}
                draggable
                data-dragging={dragId === x.id}
                data-error={!!x.error}
                onDragStart={() => setDragId(x.id)}
                onDragEnd={() => setDragId(null)}
                onDragOver={(e) => {
                  e.preventDefault();
                  dropOn(x.id);
                }}
              >
                <span className="file-index mono">{i + 1}</span>
                <PdfIcon />
                <span className="file-text">
                  <span className="file-name">{x.file.name}</span>
                  <span className="file-meta muted">
                    {x.error ?? `${formatBytes(x.file.size)} · ${x.pages === null ? 'contando páginas…' : `${x.pages} ${x.pages === 1 ? 'página' : 'páginas'}`}`}
                  </span>
                </span>
                <span className="file-actions">
                  <button className="btn btn-ghost icon-btn" onClick={() => move(x.id, -1)} disabled={i === 0} aria-label={`Subir ${x.file.name}`}>
                    ↑
                  </button>
                  <button
                    className="btn btn-ghost icon-btn"
                    onClick={() => move(x.id, 1)}
                    disabled={i === items.length - 1}
                    aria-label={`Bajar ${x.file.name}`}
                  >
                    ↓
                  </button>
                  <button className="btn btn-ghost icon-btn" onClick={() => setItems((xs) => xs.filter((y) => y.id !== x.id))} aria-label={`Quitar ${x.file.name}`}>
                    ×
                  </button>
                </span>
              </li>
            ))}
          </ol>
          <div className="file-list-foot">
            <button className="btn btn-ghost" onClick={() => setItems([])}>
              Vaciar lista
            </button>
            <button className="btn btn-primary" onClick={merge} disabled={!ready}>
              {busy ?? (valid.length < 2 ? 'Agrega al menos 2 PDF' : 'Unir y descargar')}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

export function PdfIcon() {
  return (
    <svg className="file-icon" width="28" height="34" viewBox="0 0 28 34" aria-hidden>
      <path d="M3 1h15l9 9v21a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2z" fill="var(--surface-2)" stroke="var(--line-strong)" />
      <path d="M18 1v7a2 2 0 0 0 2 2h7" fill="none" stroke="var(--line-strong)" />
      <rect x="4" y="19" width="20" height="9" rx="2" fill="var(--danger)" />
      <text x="14" y="26" textAnchor="middle" fontSize="7" fontWeight="700" fill="#fff" fontFamily="var(--font)">
        PDF
      </text>
    </svg>
  );
}
