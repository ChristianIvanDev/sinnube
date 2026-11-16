import { describe, expect, it } from 'vitest';
import { formatCoords, isSensitive, readMetadata } from './exif';
import { sampleJpeg, samplePng, sampleWebp } from './testing/fixtures';

const ZOCALO = { latitude: 19.4325, longitude: -99.133056, altitude: 2240.5 };

describe('readMetadata · JPG', () => {
  it.each([
    ['Intel (II)', true],
    ['Motorola (MM)', false],
  ])('lee cámara, fecha, autor y GPS en orden %s', (_, little) => {
    const m = readMetadata(sampleJpeg(little));
    expect(m.camera).toBe('Apple iPhone 15 Pro');
    expect(m.lens).toBe('iPhone 15 Pro back camera 6.86mm f/1.78');
    expect(m.software).toBe('17.5.1');
    expect(m.takenAt).toBe('2024-06-15 18:42:07');
    expect(m.author).toBe('Ana Torres');
    expect(m.orientation).toBe(6);
    expect(m.gps).toEqual(ZOCALO);
  });

  it('enumera los bloques y los comentarios', () => {
    const m = readMetadata(sampleJpeg());
    expect(m.blocks).toEqual(['EXIF', 'XMP', 'Perfil de color', 'Comentario']);
    expect(m.texts).toEqual([{ key: 'Comentario', value: 'Foto de las vacaciones' }]);
    expect(isSensitive(m)).toBe(true);
  });
});

describe('readMetadata · PNG y WebP', () => {
  it('lee el EXIF y los textos de un PNG', () => {
    const m = readMetadata(samplePng());
    expect(m.camera).toBe('Apple iPhone 15 Pro');
    expect(m.gps).toEqual(ZOCALO);
    expect(m.texts).toEqual([
      { key: 'Author', value: 'Ana Torres' },
      { key: 'Description', value: 'Cumpleaños de Sofía' },
    ]);
    expect(m.blocks).toEqual(['EXIF', 'Texto', 'Fecha de edición']);
  });

  it('lee el EXIF de un WebP', () => {
    const m = readMetadata(sampleWebp());
    expect(m.gps).toEqual(ZOCALO);
    expect(m.blocks).toEqual(['EXIF', 'XMP']);
  });
});

describe('robustez', () => {
  it('no falla con archivos truncados o desconocidos', () => {
    const jpg = sampleJpeg();
    for (const cut of [3, 10, 40, 120, jpg.length - 5]) expect(() => readMetadata(jpg.subarray(0, cut))).not.toThrow();
    expect(readMetadata(new TextEncoder().encode('hola'))).toEqual({ blocks: [], texts: [] });
  });

  it('una imagen sin metadatos no es sensible', () => {
    expect(isSensitive({ blocks: ['Perfil de color'], texts: [] })).toBe(false);
  });
});

describe('formatCoords', () => {
  it('usa N/S y E/O', () => {
    expect(formatCoords(ZOCALO)).toBe('19.43250° N, 99.13306° O');
    expect(formatCoords({ latitude: -33.8688, longitude: 151.2093 })).toBe('33.86880° S, 151.20930° E');
  });
});
