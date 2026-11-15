import { useEffect, useMemo, useRef, useState } from 'react';
import { FileDrop, type DroppedFile } from '../components/FileDrop';
import { toast } from '../components/Toaster';
import { downloadBlob } from '../lib/download';
import { formatBytes, formatSaving, withExtension } from '../lib/format';
import { canEncode, compressImage, EXT, outputMime, type CompressOptions, type OutputFormat } from '../lib/image';
import { IMAGE_KINDS } from '../lib/sniff';
import { createZip } from '../lib/zip';

interface Item extends DroppedFile {
  originalUrl: string;
  status: 'pending' | 'working' | 'done' | 'error';
  result?: { blob: Blob; url: string; width: number; height: number; originalWidth: number; originalHeight: number; kept: boolean };
  error?: string;
}

const FORMATS: { value: OutputFormat; label: string }[] = [
  { value: 'original', label: 'Mismo formato' },
  { value: 'webp', label: 'WebP' },
  { value: 'jpeg', label: 'JPG' },
  { value: 'png', label: 'PNG (sin pérdida)' },
  { value: 'avif', label: 'AVIF' },
];

const SIZES = [
  { value: 0, label: 'Tamaño original' },
  { value: 3840, label: '3840 px (4K)' },
  { value: 2560, label: '2560 px' },
  { value: 1920, label: '1920 px (Full HD)' },
  { value: 1280, label: '1280 px' },
  { value: 800, label: '800 px' },
];

export function CompressTool() {
  const [items, setItems] = useState<Item[]>([]);
  const [options, setOptions] = useState<CompressOptions>({ format: 'webp', quality: 0.8, maxSide: 0 });
  const [avif, setAvif] = useState(false);
  const [compareId, setCompareId] = useState<string | null>(null);
  const run = useRef(0);

  useEffect(() => {
    void canEncode('image/avif').then(setAvif);
  }, []);

  // Libera la memoria de las vistas previas al salir.
  const itemsRef = useRef(items);
  itemsRef.current = items;
  useEffect(
    () => () =>
      itemsRef.current.forEach((x) => {
        URL.revokeObjectURL(x.originalUrl);
        if (x.result) URL.revokeObjectURL(x.result.url);
      }),
    [],
  );

  const process = async (targets: Item[], opts: CompressOptions) => {
    const ticket = ++run.current;
    for (const item of targets) {
      if (ticket !== run.current) return; // los ajustes cambiaron: empieza otra pasada
      setItems((xs) => xs.map((x) => (x.id === item.id ? { ...x, status: 'working' } : x)));
      try {
        const r = await compressImage(item.file, opts);
        // Si recomprimir en el mismo formato no ahorra nada, se conserva el original.
        const sameShape = r.width === r.originalWidth && r.height === r.originalHeight;
        const kept = sameShape && r.blob.size >= item.file.size && outputMime(item.file.type, opts.format) === item.file.type;
        const blob = kept ? item.file : r.blob;
        const url = URL.createObjectURL(blob);
        if (ticket !== run.current) {
          URL.revokeObjectURL(url);
          return;
        }
        setItems((xs) =>
          xs.map((x) => {
            if (x.id !== item.id) return x;
            if (x.result) URL.revokeObjectURL(x.result.url);
            return { ...x, status: 'done', result: { ...r, blob, url, kept } };
          }),
        );
      } catch {
        setItems((xs) => xs.map((x) => (x.id === item.id ? { ...x, status: 'error', error: 'No se pudo procesar esta imagen.' } : x)));
      }
    }
  };

  const add = (files: DroppedFile[]) => {
    const fresh: Item[] = files.map((f) => ({ ...f, originalUrl: URL.createObjectURL(f.file), status: 'pending' }));
    setItems((xs) => [...xs, ...fresh]);
    void process([...items.filter((x) => x.status !== 'done'), ...fresh], options);
  };

  // Al cambiar los ajustes se recalcula todo, con una pequeña espera para no hacerlo en cada movimiento del control.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => void process(itemsRef.current, options), 250);
    return () => clearTimeout(t);
  }, [options]);

  const done = items.filter((x) => x.result);
  const before = done.reduce((n, x) => n + x.file.size, 0);
  const after = done.reduce((n, x) => n + x.result!.blob.size, 0);
  const working = items.some((x) => x.status === 'working' || x.status === 'pending');
  const compare = useMemo(() => items.find((x) => x.id === compareId && x.result), [items, compareId]);

  const nameFor = (x: Item) => withExtension(x.file.name, EXT[x.result!.blob.type] ?? 'img');

  const downloadAll = async () => {
    const entries = await Promise.all(done.map(async (x) => ({ name: nameFor(x), data: new Uint8Array(await x.result!.blob.arrayBuffer()) })));
    downloadBlob(createZip(entries), 'imagenes-comprimidas.zip', 'application/zip');
  };

  const remove = (id: string) =>
    setItems((xs) => {
      const x = xs.find((y) => y.id === id);
      if (x) {
        URL.revokeObjectURL(x.originalUrl);
        if (x.result) URL.revokeObjectURL(x.result.url);
      }
      return xs.filter((y) => y.id !== id);
    });

  return (
    <div className="tool">
      <section className="card settings" aria-label="Ajustes">
        <label className="field">
          <span>Formato de salida</span>
          <select value={options.format} onChange={(e) => setOptions({ ...options, format: e.target.value as OutputFormat })}>
            {FORMATS.map((f) => (
              <option key={f.value} value={f.value} disabled={f.value === 'avif' && !avif}>
                {f.label}
                {f.value === 'avif' && !avif ? ' (no disponible en este navegador)' : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>
            Calidad <span className="mono muted">{Math.round(options.quality * 100)}</span>
          </span>
          <input
            type="range"
            min={30}
            max={100}
            step={1}
            value={Math.round(options.quality * 100)}
            disabled={options.format === 'png'}
            onChange={(e) => setOptions({ ...options, quality: Number(e.target.value) / 100 })}
          />
        </label>
        <label className="field">
          <span>Lado mayor</span>
          <select value={options.maxSide} onChange={(e) => setOptions({ ...options, maxSide: Number(e.target.value) })}>
            {SIZES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      <FileDrop
        accept={IMAGE_KINDS}
        label="Suelta aquí tus imágenes"
        hint="Se procesan en lote, una tras otra"
        onFiles={add}
        onRejected={(names) => toast(`No son imágenes compatibles: ${names.join(', ')}`)}
      />

      {compare?.result && (
        <Compare
          before={compare.originalUrl}
          after={compare.result.url}
          label={`${compare.file.name}: ${formatBytes(compare.file.size)} → ${formatBytes(compare.result.blob.size)}`}
          onClose={() => setCompareId(null)}
        />
      )}

      {items.length > 0 && (
        <section className="card file-list" aria-label="Imágenes">
          <div className="file-list-head">
            <strong>
              {items.length} {items.length === 1 ? 'imagen' : 'imágenes'}
              {done.length > 0 && (
                <>
                  {' '}
                  · {formatBytes(before)} → {formatBytes(after)} <span className="saving">{formatSaving(before, after)}</span>
                </>
              )}
            </strong>
            <span className="muted">{working ? 'Procesando…' : 'Toca una imagen para compararla'}</span>
          </div>
          <ol>
            {items.map((x) => (
              <li key={x.id} data-error={x.status === 'error'} className="image-row">
                <button className="thumb" onClick={() => x.result && setCompareId(x.id)} aria-label={`Comparar ${x.file.name}`} disabled={!x.result}>
                  <img src={x.result?.url ?? x.originalUrl} alt="" loading="lazy" />
                </button>
                <span className="file-text">
                  <span className="file-name">{x.file.name}</span>
                  <span className="file-meta muted">
                    {x.status === 'error'
                      ? x.error
                      : x.result
                        ? `${x.result.originalWidth}×${x.result.originalHeight}${
                            x.result.width !== x.result.originalWidth ? ` → ${x.result.width}×${x.result.height}` : ''
                          } · ${formatBytes(x.file.size)} → ${formatBytes(x.result.blob.size)}${x.result.kept ? ' · ya estaba optimizada' : ''}`
                        : x.status === 'working'
                          ? 'Comprimiendo…'
                          : 'En cola'}
                  </span>
                </span>
                {x.result && <span className="saving">{formatSaving(x.file.size, x.result.blob.size)}</span>}
                <span className="file-actions">
                  <button className="btn btn-ghost" onClick={() => x.result && downloadBlob(x.result.blob, nameFor(x))} disabled={!x.result}>
                    Descargar
                  </button>
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
            <button className="btn btn-primary" onClick={downloadAll} disabled={working || done.length === 0}>
              Descargar todas (ZIP)
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

/** Comparador antes/después con un deslizador. */
function Compare({ before, after, label, onClose }: { before: string; after: string; label: string; onClose: () => void }) {
  const [pos, setPos] = useState(50);
  return (
    <section className="card compare" aria-label="Comparar antes y después">
      <div className="compare-head">
        <span className="muted">{label}</span>
        <button className="btn btn-ghost icon-btn" onClick={onClose} aria-label="Cerrar comparación">
          ×
        </button>
      </div>
      <div className="compare-stage" style={{ ['--pos' as string]: `${pos}%` }}>
        <img src={before} alt="Original" />
        <img src={after} alt="Comprimida" className="compare-after" />
        <span className="compare-line" />
        <span className="compare-tag compare-tag-l">Original</span>
        <span className="compare-tag compare-tag-r">Comprimida</span>
        <input
          type="range"
          min={0}
          max={100}
          value={pos}
          onChange={(e) => setPos(Number(e.target.value))}
          aria-label="Mover el divisor entre original y comprimida"
        />
      </div>
    </section>
  );
}
