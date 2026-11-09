/**
 * Detecta el tipo real de un archivo por sus primeros bytes («número mágico»),
 * sin fiarse de la extensión ni del tipo MIME que informa el navegador.
 */
export type FileKind = 'pdf' | 'jpeg' | 'png' | 'webp' | 'gif' | 'avif' | 'unknown';

const startsWith = (bytes: Uint8Array, sig: number[], offset = 0) => sig.every((b, i) => bytes[offset + i] === b);
const ascii = (bytes: Uint8Array, from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));

export function sniffBytes(bytes: Uint8Array): FileKind {
  if (bytes.length < 4) return 'unknown';
  // Un PDF puede tener basura antes de «%PDF-» (hasta 1 KB, según la especificación).
  const head = ascii(bytes, 0, Math.min(bytes.length, 1024));
  if (head.includes('%PDF-')) return 'pdf';
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'jpeg';
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') return 'webp';
  if (ascii(bytes, 0, 4) === 'GIF8') return 'gif';
  if (ascii(bytes, 4, 8) === 'ftyp' && /avi[fs]/.test(ascii(bytes, 8, 12))) return 'avif';
  return 'unknown';
}

export async function sniffFile(file: Blob): Promise<FileKind> {
  const buf = await file.slice(0, 1024).arrayBuffer();
  return sniffBytes(new Uint8Array(buf));
}

export const IMAGE_KINDS: FileKind[] = ['jpeg', 'png', 'webp', 'gif', 'avif'];

export const KIND_LABEL: Record<FileKind, string> = {
  pdf: 'PDF',
  jpeg: 'JPG',
  png: 'PNG',
  webp: 'WebP',
  gif: 'GIF',
  avif: 'AVIF',
  unknown: 'Desconocido',
};
