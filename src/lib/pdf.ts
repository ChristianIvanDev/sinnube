import { PDFDocument } from 'pdf-lib';

export class PdfError extends Error {}

/** Abre un PDF con mensajes de error comprensibles. */
export async function openPdf(data: ArrayBuffer | Uint8Array, name = 'El archivo'): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(data, { updateMetadata: false });
  } catch (err) {
    const msg = String((err as Error)?.message ?? err);
    if (/encrypt/i.test(msg)) throw new PdfError(`${name} está protegido con contraseña. Quítale la protección e inténtalo de nuevo.`);
    throw new PdfError(`${name} no parece un PDF válido o está dañado.`);
  }
}

export async function countPages(data: ArrayBuffer | Uint8Array, name?: string): Promise<number> {
  return (await openPdf(data, name)).getPageCount();
}

export interface PdfInput {
  name: string;
  data: ArrayBuffer | Uint8Array;
  /** Páginas a incluir (índices desde 0) en el orden deseado. Por defecto, todas. */
  pages?: number[];
}

/**
 * Une varios PDF en uno. Las páginas se copian tal cual (texto, vectores, enlaces y
 * anotaciones), sin rasterizar, así que no se pierde calidad.
 */
export async function mergePdfs(inputs: PdfInput[], onProgress?: (done: number, total: number) => void): Promise<Uint8Array> {
  if (inputs.length === 0) throw new PdfError('No hay archivos para unir.');
  const out = await PDFDocument.create();
  out.setProducer('Sinnube');
  out.setCreator('Sinnube');
  for (let i = 0; i < inputs.length; i++) {
    const src = await openPdf(inputs[i].data, inputs[i].name);
    const indices = inputs[i].pages ?? src.getPageIndices();
    const invalid = indices.filter((p) => p < 0 || p >= src.getPageCount());
    if (invalid.length) throw new PdfError(`${inputs[i].name} no tiene la página ${invalid[0] + 1}.`);
    const copied = await out.copyPages(src, indices);
    copied.forEach((page) => out.addPage(page));
    onProgress?.(i + 1, inputs.length);
  }
  if (out.getPageCount() === 0) throw new PdfError('El resultado no tendría ninguna página.');
  return out.save();
}
