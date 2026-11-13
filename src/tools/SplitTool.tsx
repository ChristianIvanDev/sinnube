import { useMemo, useState } from 'react';
import { FileDrop, type DroppedFile } from '../components/FileDrop';
import { toast } from '../components/Toaster';
import { downloadBlob } from '../lib/download';
import { formatBytes, withSuffix } from '../lib/format';
import { countPages, mergePdfs, PdfError } from '../lib/pdf';
import { describePages, parseRanges } from '../lib/ranges';
import { PdfIcon } from './MergeTool';

const EXAMPLES = ['1-3, 5', 'impares', '10-1', '2-'];

export function SplitTool() {
  const [doc, setDoc] = useState<{ file: File; pages: number } | null>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async ([f]: DroppedFile[]) => {
    try {
      const pages = await countPages(await f.file.arrayBuffer(), f.file.name);
      setDoc({ file: f.file, pages });
      setInput(pages > 1 ? `1-${Math.min(pages, 3)}` : '1');
    } catch (err) {
      toast(err instanceof PdfError ? err.message : 'No se pudo leer el PDF.');
    }
  };

  const parsed = useMemo(() => (doc ? parseRanges(input, doc.pages) : null), [doc, input]);

  const extract = async () => {
    if (!doc || !parsed || parsed.error) return;
    setBusy(true);
    try {
      const bytes = await mergePdfs([{ name: doc.file.name, data: await doc.file.arrayBuffer(), pages: parsed.pages }]);
      const label = describePages(parsed.pages).replace(/[–, ]+/g, '-');
      downloadBlob(bytes, withSuffix(doc.file.name, `paginas-${label}`.slice(0, 60)), 'application/pdf');
      toast(`Listo: ${parsed.pages.length} páginas, ${formatBytes(bytes.byteLength)}`);
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

        <div className="split-foot">
          <button className="btn btn-primary" onClick={extract} disabled={!!parsed?.error || busy}>
            {busy ? 'Procesando…' : 'Extraer y descargar'}
          </button>
        </div>
      </section>
    </div>
  );
}
