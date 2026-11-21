import { useEffect, useRef, useState } from 'react';
import { FileDrop, type DroppedFile } from '../components/FileDrop';
import { toast } from '../components/Toaster';
import { downloadBlob } from '../lib/download';
import { formatBytes } from '../lib/format';
import { imagesToPdf } from '../lib/imagesToPdf';
import { PAGE_SIZES, type PageSize } from '../lib/layout';
import { IMAGE_KINDS } from '../lib/sniff';

interface Item extends DroppedFile {
  url: string;
}

const MARGINS = [
  { value: 0, label: 'Sin margen' },
  { value: 18, label: 'Pequeño' },
  { value: 36, label: 'Normal' },
];

export function ImagesToPdfTool() {
  const [items, setItems] = useState<Item[]>([]);
  const [size, setSize] = useState<PageSize>('a4');
  const [margin, setMargin] = useState(18);
  const [dragId, setDragId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const itemsRef = useRef(items);
  itemsRef.current = items;
  useEffect(() => () => itemsRef.current.forEach((x) => URL.revokeObjectURL(x.url)), []);

  const add = (files: DroppedFile[]) => setItems((xs) => [...xs, ...files.map((f) => ({ ...f, url: URL.createObjectURL(f.file) }))]);

  const remove = (id: string) =>
    setItems((xs) => {
      const x = xs.find((y) => y.id === id);
      if (x) URL.revokeObjectURL(x.url);
      return xs.filter((y) => y.id !== id);
    });

  const dropOn = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    setItems((xs) => {
      const next = [...xs];
      const [moved] = next.splice(xs.findIndex((x) => x.id === dragId), 1);
      next.splice(xs.findIndex((x) => x.id === targetId), 0, moved);
      return next;
    });
  };

  const create = async () => {
    setBusy('Preparando…');
    try {
      const bytes = await imagesToPdf(
        items.map((x) => x.file),
        { size, marginPt: size === 'imagen' ? 0 : margin },
        (done, total) => setBusy(`Página ${done} de ${total}…`),
      );
      downloadBlob(bytes, 'imagenes.pdf', 'application/pdf');
      toast(`Listo: ${items.length} ${items.length === 1 ? 'página' : 'páginas'}, ${formatBytes(bytes.byteLength)}`);
    } catch {
      toast('No se pudo crear el PDF con alguna de las imágenes.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="tool">
      <section className="card settings" aria-label="Ajustes">
        <label className="field">
          <span>Tamaño de página</span>
          <select value={size} onChange={(e) => setSize(e.target.value as PageSize)}>
            {Object.entries(PAGE_SIZES).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
            <option value="imagen">Igual que cada imagen</option>
          </select>
        </label>
        <label className="field">
          <span>Margen</span>
          <select value={margin} onChange={(e) => setMargin(Number(e.target.value))} disabled={size === 'imagen'}>
            {MARGINS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <p className="help settings-note">Las fotos apaisadas giran su página automáticamente. Las fotos JPG no se recomprimen.</p>
      </section>

      <FileDrop
        accept={IMAGE_KINDS}
        label="Suelta aquí tus imágenes"
        hint="Cada imagen será una página, en este orden"
        onFiles={add}
        onRejected={(names) => toast(`No son imágenes compatibles: ${names.join(', ')}`)}
      />

      {items.length > 0 && (
        <section className="card file-list" aria-label="Páginas">
          <div className="file-list-head">
            <strong>
              {items.length} {items.length === 1 ? 'página' : 'páginas'}
            </strong>
            <span className="muted">Arrastra para cambiar el orden</span>
          </div>
          <ol className="image-grid">
            {items.map((x, i) => (
              <li
                key={x.id}
                draggable
                data-dragging={dragId === x.id}
                onDragStart={() => setDragId(x.id)}
                onDragEnd={() => setDragId(null)}
                onDragOver={(e) => {
                  e.preventDefault();
                  dropOn(x.id);
                }}
              >
                <img src={x.url} alt={`Página ${i + 1}: ${x.file.name}`} loading="lazy" />
                <span className="image-grid-meta">
                  <span className="mono">{i + 1}</span>
                  <button className="btn btn-ghost icon-btn" onClick={() => remove(x.id)} aria-label={`Quitar ${x.file.name}`}>
                    ×
                  </button>
                </span>
              </li>
            ))}
          </ol>
          <div className="file-list-foot">
            <button className="btn btn-ghost" onClick={() => items.forEach((x) => remove(x.id))}>
              Vaciar lista
            </button>
            <button className="btn btn-primary" onClick={create} disabled={!!busy}>
              {busy ?? 'Crear PDF'}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
