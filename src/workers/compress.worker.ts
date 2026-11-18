/// <reference lib="webworker" />
// Comprime imágenes fuera del hilo principal con OffscreenCanvas.
import { fitSize, needsBackground, outputMime, type CompressOptions } from '../lib/image';

export interface CompressRequest {
  id: number;
  file: Blob;
  options: CompressOptions;
}

export type CompressResponse =
  | { id: number; ok: true; blob: Blob; width: number; height: number; originalWidth: number; originalHeight: number }
  | { id: number; ok: false; error: string };

declare const self: DedicatedWorkerGlobalScope;

self.onmessage = async (e: MessageEvent<CompressRequest>) => {
  const { id, file, options } = e.data;
  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const { width, height } = fitSize(bitmap.width, bitmap.height, options.maxSide);
    const mime = outputMime(file.type, options.format);
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d')!;
    if (needsBackground(mime)) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
    }
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await canvas.convertToBlob({ type: mime, quality: options.quality });
    // Si el navegador no sabe codificar ese formato, devuelve PNG en silencio: lo detectamos.
    if (blob.type !== mime) throw new Error(`Este navegador no puede generar ${mime}.`);
    const res: CompressResponse = { id, ok: true, blob, width, height, originalWidth: bitmap.width, originalHeight: bitmap.height };
    self.postMessage(res);
  } catch (err) {
    self.postMessage({ id, ok: false, error: (err as Error)?.message ?? String(err) } satisfies CompressResponse);
  } finally {
    bitmap?.close();
  }
};
