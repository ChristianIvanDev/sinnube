export type OutputFormat = 'original' | 'webp' | 'jpeg' | 'png' | 'avif';

export interface CompressOptions {
  format: OutputFormat;
  /** 0–1. Se ignora en PNG, que no tiene pérdida. */
  quality: number;
  /** Lado mayor máximo en píxeles; 0 = sin cambios. */
  maxSide: number;
}

export const MIME: Record<Exclude<OutputFormat, 'original'>, string> = {
  webp: 'image/webp',
  jpeg: 'image/jpeg',
  png: 'image/png',
  avif: 'image/avif',
};

export const EXT: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/avif': 'avif',
  'image/gif': 'gif',
};

/** Escala proporcional para que el lado mayor no pase de `maxSide`. Nunca amplía. */
export function fitSize(width: number, height: number, maxSide: number): { width: number; height: number } {
  if (!maxSide || (width <= maxSide && height <= maxSide)) return { width, height };
  const scale = maxSide / Math.max(width, height);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/**
 * Tipo de salida para un archivo. «original» conserva el formato, salvo GIF (el canvas solo
 * puede exportar el primer fotograma, así que se convierte a PNG para no perder transparencia).
 */
export function outputMime(inputMime: string, format: OutputFormat): string {
  if (format !== 'original') return MIME[format];
  if (inputMime === 'image/jpeg' || inputMime === 'image/png' || inputMime === 'image/webp' || inputMime === 'image/avif') return inputMime;
  return 'image/png';
}

/** Formatos sin canal alfa: hay que pintar un fondo o la transparencia quedaría negra. */
export const needsBackground = (mime: string) => mime === 'image/jpeg';

const supportCache = new Map<string, boolean>();

/** Comprueba si el navegador sabe codificar un formato (AVIF aún no en todos). */
export async function canEncode(mime: string): Promise<boolean> {
  if (supportCache.has(mime)) return supportCache.get(mime)!;
  let ok = false;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 2;
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, mime, 0.5));
    ok = blob?.type === mime;
  } catch {
    ok = false;
  }
  supportCache.set(mime, ok);
  return ok;
}

export interface CompressResult {
  blob: Blob;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
}

/**
 * Recodifica una imagen con un canvas. De paso elimina los metadatos (EXIF, GPS), porque el
 * canvas solo conserva los píxeles. La orientación de la cámara se aplica antes de dibujar.
 */
export async function compressImage(file: Blob, options: CompressOptions): Promise<CompressResult> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const { width, height } = fitSize(bitmap.width, bitmap.height, options.maxSide);
    const mime = outputMime(file.type, options.format);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    if (needsBackground(mime)) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
    }
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, mime, options.quality));
    if (!blob) throw new Error('El navegador no pudo codificar la imagen.');
    if (blob.type !== mime) throw new Error(`Este navegador no puede generar ${mime}.`);
    return { blob, width, height, originalWidth: bitmap.width, originalHeight: bitmap.height };
  } finally {
    bitmap.close();
  }
}
