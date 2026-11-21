import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { imagesToPdf } from './imagesToPdf';
import { sampleJpeg } from './testing/fixtures';

const contains = (bytes: Uint8Array, text: string) => new TextDecoder('latin1').decode(bytes).includes(text);

describe('imagesToPdf', () => {
  // Foto JPG con EXIF completo (GPS, cámara, autor) y orientación normal: va por el camino sin recomprimir.
  const photoBytes = sampleJpeg(true, 1);
  const photo = new Blob([photoBytes], { type: 'image/jpeg' });

  it('crea una página por imagen con el tamaño elegido', async () => {
    const doc = await PDFDocument.load(await imagesToPdf([photo, photo], { size: 'a4', marginPt: 18 }));
    expect(doc.getPageCount()).toBe(2);
    expect(Math.round(doc.getPage(0).getWidth())).toBe(842); // 4×3 px es apaisada: A4 girada
  });

  it('con «imagen» la página mide lo mismo que la foto', async () => {
    const doc = await PDFDocument.load(await imagesToPdf([photo], { size: 'imagen', marginPt: 0 }));
    expect(doc.getPage(0).getSize()).toEqual({ width: 3, height: 2.25 });
  });

  it('no esconde los metadatos de la foto dentro del PDF', async () => {
    expect(contains(photoBytes, 'Ana Torres')).toBe(true);
    expect(contains(photoBytes, 'iPhone')).toBe(true);
    const pdf = await imagesToPdf([photo], { size: 'a4', marginPt: 0 });
    expect(contains(pdf, 'Ana Torres')).toBe(false);
    expect(contains(pdf, 'iPhone')).toBe(false);
    expect(contains(pdf, 'Foto de las vacaciones')).toBe(false);
  });
});
