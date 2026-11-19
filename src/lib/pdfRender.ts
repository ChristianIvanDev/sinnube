import type { PDFDocumentProxy } from 'pdfjs-dist';

/**
 * pdf.js pesa ~1 MB: se carga solo cuando hace falta dibujar páginas y sus análisis
 * corren en su propio worker.
 */
let lib: Promise<typeof import('pdfjs-dist')> | null = null;

function loadPdfJs() {
  lib ??= Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]).then(([pdfjs, worker]) => {
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    return pdfjs;
  });
  return lib;
}

export async function openForRender(data: ArrayBuffer): Promise<PDFDocumentProxy> {
  const pdfjs = await loadPdfJs();
  // pdf.js se queda con el ArrayBuffer: le pasamos una copia para poder seguir usando el original.
  return pdfjs.getDocument({ data: new Uint8Array(data.slice(0)), isEvalSupported: false }).promise;
}

/** Dibuja una página en un canvas con el ancho indicado (en píxeles CSS). */
export async function renderPage(doc: PDFDocumentProxy, index: number, canvas: HTMLCanvasElement, cssWidth: number): Promise<void> {
  const page = await doc.getPage(index + 1);
  const base = page.getViewport({ scale: 1 });
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const viewport = page.getViewport({ scale: (cssWidth / base.width) * dpr });
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  canvas.style.aspectRatio = `${base.width} / ${base.height}`;
  await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise;
  page.cleanup();
}
