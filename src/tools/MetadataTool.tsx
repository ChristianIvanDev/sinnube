import { useState } from 'react';
import { FileDrop, type DroppedFile } from '../components/FileDrop';
import { toast } from '../components/Toaster';
import { formatCoords, isSensitive, readMetadata, type Metadata } from '../lib/exif';
import { downloadBlob } from '../lib/download';
import { formatBytes } from '../lib/format';
import { stripMetadata } from '../lib/strip';
import { createZip } from '../lib/zip';

async function cleanBytes(file: File): Promise<Uint8Array> {
  return stripMetadata(new Uint8Array(await file.arrayBuffer()));
}

async function downloadClean(file: File) {
  try {
    const before = file.size;
    const clean = await cleanBytes(file);
    downloadBlob(clean, file.name, file.type);
    toast(`Listo: ${formatBytes(before - clean.length)} de metadatos eliminados, la imagen no se tocó`);
  } catch {
    toast('No se pudo limpiar esta foto.');
  }
}

interface Item extends DroppedFile {
  meta: Metadata;
  preview: string;
}

const ORIENTATION: Record<number, string> = {
  1: 'Normal',
  3: 'Girada 180°',
  6: 'Girada 90° a la derecha',
  8: 'Girada 90° a la izquierda',
};

export function MetadataTool() {
  const [items, setItems] = useState<Item[]>([]);

  const add = async (files: DroppedFile[]) => {
    const read = await Promise.all(
      files.map(async (f) => ({
        ...f,
        meta: readMetadata(new Uint8Array(await f.file.arrayBuffer())),
        preview: URL.createObjectURL(f.file),
      })),
    );
    setItems((xs) => [...read, ...xs]);
  };

  const exposed = items.filter((x) => x.meta.gps).length;
  const dirty = items.filter((x) => isSensitive(x.meta));

  const cleanAll = async () => {
    try {
      const entries = await Promise.all(dirty.map(async (x) => ({ name: x.file.name, data: await cleanBytes(x.file) })));
      if (entries.length === 1) downloadBlob(entries[0].data, entries[0].name, dirty[0].file.type);
      else downloadBlob(createZip(entries), 'fotos-sin-metadatos.zip', 'application/zip');
      toast(`${entries.length === 1 ? 'Foto limpia' : `${entries.length} fotos limpias`}, sin perder calidad`);
    } catch {
      toast('No se pudo limpiar alguna de las fotos.');
    }
  };

  return (
    <div className="tool">
      <FileDrop
        accept={['jpeg', 'png', 'webp']}
        label="Suelta aquí tus fotos"
        hint="Verás todo lo que guardan, sin que salgan de tu equipo"
        onFiles={add}
        onRejected={(names) => toast(`Formato no compatible: ${names.join(', ')}`)}
      />

      {items.length > 0 && (
        <p className="summary-line">
          {exposed > 0 ? (
            <>
              <span className="dot dot-danger" />
              {exposed === 1 ? '1 foto revela' : `${exposed} fotos revelan`} el lugar exacto donde se tomó.
            </>
          ) : (
            <>
              <span className="dot dot-good" />
              Ninguna de estas fotos contiene ubicación GPS.
            </>
          )}
          {dirty.length > 0 && (
            <button className="btn btn-primary" onClick={cleanAll}>
              {dirty.length === 1 ? 'Limpiar y descargar' : `Limpiar las ${dirty.length} (ZIP)`}
            </button>
          )}
        </p>
      )}

      {items.map((x) => (
        <MetaCard key={x.id} item={x} />
      ))}
    </div>
  );
}

function MetaCard({ item }: { item: Item }) {
  const { meta } = item;
  const rows: [string, string][] = [];
  if (meta.camera) rows.push(['Cámara', meta.camera]);
  if (meta.lens) rows.push(['Lente', meta.lens]);
  if (meta.takenAt) rows.push(['Fecha', meta.takenAt]);
  if (meta.author) rows.push(['Autor', meta.author]);
  if (meta.copyright) rows.push(['Derechos', meta.copyright]);
  if (meta.software) rows.push(['Programa', meta.software]);
  if (meta.orientation && meta.orientation !== 1) rows.push(['Orientación', ORIENTATION[meta.orientation] ?? `Código ${meta.orientation}`]);
  for (const t of meta.texts) rows.push([t.key, t.value]);

  return (
    <article className="card meta-card">
      <img className="meta-preview" src={item.preview} alt="" />
      <div className="meta-body">
        <header className="meta-head">
          <span className="file-name">{item.file.name}</span>
          <span className="muted">{formatBytes(item.file.size)}</span>
          <span className={isSensitive(meta) ? 'tag tag-warn' : 'tag tag-good'}>{isSensitive(meta) ? 'Tiene metadatos' : 'Limpia'}</span>
        </header>

        {meta.gps && (
          <div className="gps-alert" role="note">
            <strong>Ubicación exacta</strong>
            <span className="mono">{formatCoords(meta.gps)}</span>
            {meta.gps.altitude !== undefined && <span className="muted">Altitud: {meta.gps.altitude} m</span>}
          </div>
        )}

        {rows.length > 0 ? (
          <dl className="meta-list">
            {rows.map(([k, v], i) => (
              <div key={i}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        ) : (
          !meta.gps && <p className="muted">No encontramos datos personales en esta imagen.</p>
        )}

        <footer className="meta-foot">
          {meta.blocks.length > 0 && <span className="meta-blocks muted">Bloques encontrados: {meta.blocks.join(' · ')}</span>}
          {isSensitive(meta) && (
            <button className="btn" onClick={() => void downloadClean(item.file)}>
              Descargar sin metadatos
            </button>
          )}
        </footer>
      </div>
    </article>
  );
}
