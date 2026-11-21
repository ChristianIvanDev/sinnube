import { describe, expect, it } from 'vitest';
import { PAGE_SIZES, placeImage } from './layout';

const round = (p: ReturnType<typeof placeImage>) => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, Math.round(v * 10) / 10]));

describe('placeImage', () => {
  it('con «imagen» la página mide lo mismo que la foto', () => {
    expect(round(placeImage(960, 1280, 'imagen'))).toEqual({ pageWidth: 720, pageHeight: 960, x: 0, y: 0, width: 720, height: 960 });
  });

  it('ajusta una foto vertical grande a A4 sin deformarla', () => {
    const p = placeImage(3000, 4000, 'a4', 36);
    expect(p.pageWidth).toBe(PAGE_SIZES.a4.width);
    expect(p.width / p.height).toBeCloseTo(3000 / 4000, 5);
    expect(p.width).toBeLessThanOrEqual(PAGE_SIZES.a4.width - 72 + 1e-9);
    expect(p.height).toBeLessThanOrEqual(PAGE_SIZES.a4.height - 72 + 1e-9);
  });

  it('gira la página para fotos apaisadas', () => {
    const p = placeImage(4000, 3000, 'carta');
    expect(p.pageWidth).toBe(792);
    expect(p.pageHeight).toBe(612);
  });

  it('centra la imagen', () => {
    const p = placeImage(4000, 3000, 'a4', 20);
    expect(p.x).toBeCloseTo((p.pageWidth - p.width) / 2, 5);
    expect(p.y).toBeCloseTo((p.pageHeight - p.height) / 2, 5);
  });

  it('nunca amplía una imagen pequeña', () => {
    const p = placeImage(200, 100, 'a4');
    expect(p.width).toBe(150);
    expect(p.height).toBe(75);
  });
});
