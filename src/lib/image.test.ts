import { describe, expect, it } from 'vitest';
import { fitSize, needsBackground, outputMime } from './image';

describe('fitSize', () => {
  it('reduce manteniendo la proporción', () => {
    expect(fitSize(4000, 3000, 1920)).toEqual({ width: 1920, height: 1440 });
    expect(fitSize(3000, 4000, 1920)).toEqual({ width: 1440, height: 1920 });
  });

  it('nunca amplía ni cambia sin límite', () => {
    expect(fitSize(800, 600, 1920)).toEqual({ width: 800, height: 600 });
    expect(fitSize(4000, 3000, 0)).toEqual({ width: 4000, height: 3000 });
  });

  it('no deja lados de 0 píxeles en imágenes muy alargadas', () => {
    expect(fitSize(10000, 2, 100)).toEqual({ width: 100, height: 1 });
  });
});

describe('outputMime', () => {
  it('conserva el formato original cuando se puede', () => {
    expect(outputMime('image/jpeg', 'original')).toBe('image/jpeg');
    expect(outputMime('image/png', 'original')).toBe('image/png');
  });

  it('convierte GIF a PNG para no perder la transparencia', () => {
    expect(outputMime('image/gif', 'original')).toBe('image/png');
  });

  it('usa el formato elegido', () => {
    expect(outputMime('image/png', 'webp')).toBe('image/webp');
    expect(outputMime('image/png', 'jpeg')).toBe('image/jpeg');
  });

  it('solo JPG necesita fondo', () => {
    expect(needsBackground('image/jpeg')).toBe(true);
    expect(needsBackground('image/webp')).toBe(false);
  });
});
