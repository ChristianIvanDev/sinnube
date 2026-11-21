import { PDFDocument } from 'pdf-lib';
import { readMetadata } from './exif';
import { placeImage, type PageSize } from './layout';
import { sniffBytes } from './sniff';
import { stripJpeg, stripPng } from './strip';

export interface ImagesToPdfOptions {
  size: PageSize;
  marginPt: number;
}

/**
 * Convierte imágenes en un PDF, una por página.
 * - JPG sin rotación: se incrusta tal cual (sin pérdida), después de quitarle los metadatos;
 *   si no, el GPS de la foto quedaría escondido dentro del PDF.
 * - PNG: se incrusta tal cual, sin sus textos ni EXIF, y conserva la transparencia.
 * - El resto (WebP, GIF, AVIF, JPG girados): se dibuja en un canvas y se guarda como JPG.
 */
export async function imagesToPdf(files: Blob[], options: ImagesToPdfOptions, onProgress?: (done: number, total: number) => void): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setProducer('Sinnube');
  doc.setCreator('Sinnube');

  for (let i = 0; i < files.length; i++) {
    const bytes = new Uint8Array(await files[i].arrayBuffer());
    const kind = sniffBytes(bytes);
    let image;
    if (kind === 'jpeg' && (readMetadata(bytes).orientation ?? 1) === 1) image = await doc.embedJpg(stripJpeg(bytes, false));
    else if (kind === 'png') image = await doc.embedPng(stripPng(bytes));
    else image = await doc.embedJpg(await rasterToJpeg(files[i]));

    const p = placeImage(image.width, image.height, options.size, options.marginPt);
    const page = doc.addPage([p.pageWidth, p.pageHeight]);
    page.drawImage(image, { x: p.x, y: p.y, width: p.width, height: p.height });
    onProgress?.(i + 1, files.length);
  }
  return doc.save();
}

async function rasterToJpeg(file: Blob): Promise<Uint8Array> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff'; // el PDF no tendría fondo y la transparencia quedaría negra
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.92));
    if (!blob) throw new Error('No se pudo convertir la imagen.');
    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    bitmap.close();
  }
}
