/** Tamaños de página en puntos PDF (1 pt = 1/72 de pulgada). */
export const PAGE_SIZES = {
  a4: { label: 'A4', width: 595.28, height: 841.89 },
  carta: { label: 'Carta', width: 612, height: 792 },
  oficio: { label: 'Oficio', width: 612, height: 1008 },
} as const;

export type PageSize = keyof typeof PAGE_SIZES | 'imagen';

export interface Placement {
  pageWidth: number;
  pageHeight: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Coloca una imagen en una página. Con «imagen», la página mide lo mismo que la imagen (a 96 ppp).
 * Con un tamaño fijo, la página se gira si la imagen es apaisada, y la imagen se escala para caber
 * dentro de los márgenes sin deformarse y centrada. Nunca se amplía por encima de su tamaño real.
 */
export function placeImage(imgWidth: number, imgHeight: number, size: PageSize, marginPt = 0): Placement {
  const PX_TO_PT = 72 / 96;
  const natW = imgWidth * PX_TO_PT;
  const natH = imgHeight * PX_TO_PT;

  if (size === 'imagen') {
    return { pageWidth: natW + marginPt * 2, pageHeight: natH + marginPt * 2, x: marginPt, y: marginPt, width: natW, height: natH };
  }

  const base = PAGE_SIZES[size];
  const landscape = imgWidth > imgHeight;
  const pageWidth = landscape ? base.height : base.width;
  const pageHeight = landscape ? base.width : base.height;
  const boxW = pageWidth - marginPt * 2;
  const boxH = pageHeight - marginPt * 2;
  const scale = Math.min(boxW / natW, boxH / natH, 1);
  const width = natW * scale;
  const height = natH * scale;
  return { pageWidth, pageHeight, x: (pageWidth - width) / 2, y: (pageHeight - height) / 2, width, height };
}
