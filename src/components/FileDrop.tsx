import { useEffect, useId, useRef, useState, type DragEvent } from 'react';
import { KIND_LABEL, sniffFile, type FileKind } from '../lib/sniff';

export interface DroppedFile {
  id: string;
  file: File;
  kind: FileKind;
}

interface Props {
  accept: FileKind[];
  multiple?: boolean;
  label: string;
  hint: string;
  onFiles: (files: DroppedFile[]) => void;
  onRejected?: (names: string[]) => void;
}

const MIME: Partial<Record<FileKind, string>> = {
  pdf: 'application/pdf',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
};

let counter = 0;

/** Zona para soltar, elegir o pegar archivos. Comprueba el tipo real de cada uno antes de aceptarlo. */
export function FileDrop({ accept, multiple = true, label, hint, onFiles, onRejected }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const id = useId();

  const handle = async (list: FileList | File[]) => {
    const files = Array.from(list).slice(0, multiple ? undefined : 1);
    const checked = await Promise.all(files.map(async (file) => ({ file, kind: await sniffFile(file) })));
    const ok = checked.filter((f) => accept.includes(f.kind));
    const bad = checked.filter((f) => !accept.includes(f.kind)).map((f) => f.file.name);
    if (ok.length) onFiles(ok.map((f) => ({ ...f, id: `f${++counter}` })));
    if (bad.length) onRejected?.(bad);
  };

  // Pegar con Ctrl+V desde el portapapeles (capturas de pantalla, por ejemplo).
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = e.clipboardData?.files;
      if (files?.length) {
        e.preventDefault();
        void handle(files);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  });

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    if (e.dataTransfer.files.length) void handle(e.dataTransfer.files);
  };

  return (
    <div
      className="drop"
      data-over={over}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false);
      }}
      onDrop={onDrop}
    >
      <input
        ref={inputRef}
        id={id}
        type="file"
        hidden
        multiple={multiple}
        accept={accept.map((k) => MIME[k]).filter(Boolean).join(',')}
        onChange={(e) => {
          if (e.target.files) void handle(e.target.files);
          e.target.value = '';
        }}
      />
      <DropIcon />
      <p className="drop-label">{label}</p>
      <p className="drop-hint muted">
        {hint} · {accept.map((k) => KIND_LABEL[k]).join(', ')}
      </p>
      <button className="btn btn-primary" onClick={() => inputRef.current?.click()}>
        Elegir archivos
      </button>
    </div>
  );
}

function DropIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M12 15V4m0 0L8 8m4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 14v3a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-3" strokeLinecap="round" />
    </svg>
  );
}
