import { useMemo, useState } from 'react';
import { FileDrop, type DroppedFile } from '../components/FileDrop';
import { PageGrid } from '../components/PageGrid';
import { toast } from '../components/Toaster';
import { downloadBlob } from '../lib/download';
import { formatBytes, withExtension, withSuffix } from '../lib/format';
import { countPages, mergePdfs, PdfError } from '../lib/pdf';
import { describePages, parseRanges } from '../lib/ranges';
import { createZip } from '../lib/zip';
import { PdfIcon } from './MergeTool';

const EXAMPLES = ['1-3, 5', 'impares', '10-1', '2-', '1, 2, 3'];

export function SplitTool() {
  const [doc, setDoc] = useState<{ file: File; pages: number; data: ArrayBuffer } | null>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'single' | 'groups'>('single');

  const load = async ([f]: DroppedFile[]) => {
    try {
      const data = await f.file.arrayBuffer();
      const pages = await countPages(data, f.file.name);
      setDoc({ file: f.file, pages, data });
      setInput(pages > 1 ? `1-${Math.min(pages, 3)}` : '1');
    } catch (err) {
      toast(err instanceof PdfError ? err.message : 'No se pudo leer el PDF.');
    }
  };

  const parsed = useMemo(() => (doc ? parseRanges(input, doc.pages) : null), [doc, input]);
  const groups = parsed && !parsed.error ? parsed.groups.length : 0;

  // Tocar una miniatura la agrega al final o la quita; el texto se reescribe para que ambos coincidan.
  const toggle = (page: number) => {
    const current = parsed && !parsed.error ? parsed.pages : [];
    const next = current.includes(page) ? current.filter((p) => p !== page) : [...current, page];
    setInput(describePages(next));
  };

  const fileLabel = (pages: number[]) => describePages(pages).replace(/[–, ]+/g, '-').slice(0, 60);

  const extract = async () => {
    if (!doc || !parsed || parsed.error) return;
    setBusy(true);
    try {
      const data = await doc.file.arrayBuffer();
      if (mode === 'single' || parsed.groups.length === 1) {
        const bytes = await mergePdfs([{ name: doc.file.name, data, pages: parsed.pages }]);
        downloadBlob(bytes, withSuffix(doc.file.name, `paginas-${fileLabel(parsed.pages)}`), 'application/pdf');
        toast(`Listo: ${parsed.pages.length} páginas, ${formatBytes(bytes.byteLength)}`);
      } else {
        // Un PDF por cada grupo separado por comas, empaquetados en un solo ZIP.
        const entries = [];
        for (const group of parsed.groups) {
          const bytes = await mergePdfs([{ name: doc.file.name, data, pages: group }]);
          entries.push({ name: withSuffix(doc.file.name, `paginas-${fileLabel(group)}`), data: bytes });
        }
        const zip = createZip(entries);
        downloadBlob(zip, withExtension(withSuffix(doc.file.name, 'dividido'), 'zip'), 'application/zip');
        toast(`Listo: ${entries.length} PDF en un ZIP de ${formatBytes(zip.byteLength)}`);
      }
    } catch (err) {
      toast(err instanceof PdfError ? err.message : 'Algo salió mal al extraer las páginas.');
    } finally {
      setBusy(false);
    }
  };

  if (!doc) {
    return (
      <div className="tool">
        <FileDrop
          accept={['pdf']}
          multiple={false}
          label="Suelta aquí un PDF"
          hint="Elige las páginas que quieres conservar"
          onFiles={load}
          onRejected={() => toast('Ese archivo no es un PDF.')}
        />
      </div>
    );
  }

  return (
    <div className="tool">
      <section className="card split">
        <div className="split-file">
          <PdfIcon />
          <span className="file-text">
            <span className="file-name">{doc.file.name}</span>
            <span className="file-meta muted">
              {formatBytes(doc.file.size)} · {doc.pages} {doc.pages === 1 ? 'página' : 'páginas'}
            </span>
          </span>
          <button className="btn btn-ghost" onClick={() => setDoc(null)}>
            Cambiar archivo
          </button>
        </div>

        <label className="field">
          <span>Páginas a conservar</span>
          <input
            className="mono"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void extract()}
            placeholder="1-3, 5, 8-"
            aria-invalid={!!parsed?.error}
            aria-describedby="split-help"
          />
        </label>
        <div className="chips" aria-label="Ejemplos">
          {EXAMPLES.map((ex) => (
            <button key={ex} className="chip mono" onClick={() => setInput(ex)}>
              {ex}
            </button>
          ))}
        </div>
        <p id="split-help" className={parsed?.error ? 'help help-error' : 'help'}>
          {parsed?.error ??
            `Se ${parsed!.pages.length === 1 ? 'incluirá 1 página' : `incluirán ${parsed!.pages.length} páginas`}: ${describePages(parsed!.pages)}`}
        </p>

        <PageGrid data={doc.data} total={doc.pages} selected={parsed && !parsed.error ? parsed.pages : []} onToggle={toggle} />

        <fieldset className="radio-group">
          <legend>Resultado</legend>
          <label>
            <input type="radio" name="split-mode" checked={mode === 'single'} onChange={() => setMode('single')} />
            <span>
              <strong>Un solo PDF</strong>
              <span className="muted">Todas las páginas elegidas, en ese orden</span>
            </span>
          </label>
          <label>
            <input type="radio" name="split-mode" checked={mode === 'groups'} onChange={() => setMode('groups')} />
            <span>
              <strong>Un PDF por cada grupo</strong>
              <span className="muted">
                Cada parte separada por comas es un archivo
                {groups > 1 ? ` (${groups} archivos en un ZIP)` : ''}
              </span>
            </span>
          </label>
        </fieldset>

        <div className="split-foot">
          <button className="btn btn-primary" onClick={extract} disabled={!!parsed?.error || busy}>
            {busy ? 'Procesando…' : mode === 'groups' && groups > 1 ? `Dividir en ${groups} archivos` : 'Extraer y descargar'}
          </button>
        </div>
      </section>
    </div>
  );
}
