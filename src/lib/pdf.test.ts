import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { countPages, mergePdfs, PdfError } from './pdf';

/** Crea un PDF de prueba cuyas páginas tienen anchos distintos para poder identificarlas. */
async function makePdf(widths: number[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  widths.forEach((w) => doc.addPage([w, 800]));
  return doc.save();
}

async function widthsOf(bytes: Uint8Array): Promise<number[]> {
  const doc = await PDFDocument.load(bytes);
  return doc.getPages().map((p) => Math.round(p.getWidth()));
}

describe('mergePdfs', () => {
  it('une los archivos en el orden indicado', async () => {
    const a = await makePdf([100, 101]);
    const b = await makePdf([200]);
    const merged = await mergePdfs([
      { name: 'b.pdf', data: b },
      { name: 'a.pdf', data: a },
    ]);
    expect(await widthsOf(merged)).toEqual([200, 100, 101]);
  });

  it('respeta una selección y un orden de páginas', async () => {
    const a = await makePdf([100, 101, 102, 103]);
    const merged = await mergePdfs([{ name: 'a.pdf', data: a, pages: [3, 0, 2] }]);
    expect(await widthsOf(merged)).toEqual([103, 100, 102]);
  });

  it('informa del progreso', async () => {
    const steps: string[] = [];
    await mergePdfs(
      [
        { name: 'a.pdf', data: await makePdf([100]) },
        { name: 'b.pdf', data: await makePdf([100]) },
      ],
      (done, total) => steps.push(`${done}/${total}`),
    );
    expect(steps).toEqual(['1/2', '2/2']);
  });

  it('da errores claros', async () => {
    await expect(mergePdfs([])).rejects.toThrow('No hay archivos');
    await expect(mergePdfs([{ name: 'roto.pdf', data: new TextEncoder().encode('no soy un pdf') }])).rejects.toThrow(
      'roto.pdf no parece un PDF válido',
    );
    await expect(mergePdfs([{ name: 'a.pdf', data: await makePdf([100]), pages: [5] }])).rejects.toBeInstanceOf(PdfError);
  });
});

describe('countPages', () => {
  it('cuenta las páginas', async () => {
    expect(await countPages(await makePdf([1, 2, 3]))).toBe(3);
  });
});
