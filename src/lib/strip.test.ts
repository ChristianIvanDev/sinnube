import { describe, expect, it } from 'vitest';
import { isSensitive, readMetadata } from './exif';
import { stripJpeg, stripMetadata, stripPng, stripWebp } from './strip';
import { sampleJpeg, samplePng, sampleWebp } from './testing/fixtures';
import { crc32 } from './zip';

const indexOfSeq = (b: Uint8Array, seq: number[]) => {
  outer: for (let i = 0; i <= b.length - seq.length; i++) {
    for (let k = 0; k < seq.length; k++) if (b[i + k] !== seq[k]) continue outer;
    return i;
  }
  return -1;
};

describe('stripJpeg', () => {
  const original = sampleJpeg();
  const clean = stripJpeg(original);

  it('elimina GPS, cámara, autor, XMP y comentarios', () => {
    const m = readMetadata(clean);
    expect(m.gps).toBeUndefined();
    expect(m.camera).toBeUndefined();
    expect(m.author).toBeUndefined();
    expect(m.takenAt).toBeUndefined();
    expect(m.texts).toEqual([]);
    expect(m.blocks).toEqual(['EXIF', 'Perfil de color']); // EXIF mínimo con la orientación
  });

  it('conserva la orientación y el perfil de color', () => {
    expect(readMetadata(clean).orientation).toBe(6);
    expect(indexOfSeq(clean, [...'ICC_PROFILE'].map((c) => c.charCodeAt(0)))).toBeGreaterThan(0);
  });

  it('copia la imagen comprimida byte a byte', () => {
    const sos = (b: Uint8Array) => b.subarray(indexOfSeq(b, [0xff, 0xda]));
    expect([...sos(clean)]).toEqual([...sos(original)]);
  });

  it('mantiene JFIF como primer segmento', () => {
    expect([...clean.subarray(0, 4)]).toEqual([0xff, 0xd8, 0xff, 0xe0]);
    const afterJfif = 4 + ((clean[4] << 8) | clean[5]);
    expect([...clean.subarray(afterJfif, afterJfif + 2)]).toEqual([0xff, 0xe1]); // la orientación va después
  });

  it('puede quitar también la orientación', () => {
    const m = readMetadata(stripJpeg(original, false));
    expect(m.orientation).toBeUndefined();
    expect(isSensitive(m)).toBe(false);
  });

  it('el resultado es más pequeño y limpiar dos veces no cambia nada', () => {
    expect(clean.length).toBeLessThan(original.length);
    expect([...stripJpeg(clean)]).toEqual([...clean]);
  });
});

describe('stripPng', () => {
  const clean = stripPng(samplePng());

  it('elimina EXIF, textos y fecha', () => {
    const m = readMetadata(clean);
    expect(m.blocks).toEqual([]);
    expect(m.texts).toEqual([]);
  });

  it('deja un PNG con fragmentos íntegros', () => {
    const view = new DataView(clean.buffer, clean.byteOffset, clean.byteLength);
    const types: string[] = [];
    let p = 8;
    while (p < clean.length) {
      const len = view.getUint32(p);
      types.push(String.fromCharCode(...clean.subarray(p + 4, p + 8)));
      expect(view.getUint32(p + 8 + len)).toBe(crc32(clean.subarray(p + 4, p + 8 + len)));
      p += 12 + len;
    }
    expect(types).toEqual(['IHDR', 'IDAT', 'IEND']);
  });
});

describe('stripWebp', () => {
  const clean = stripWebp(sampleWebp());

  it('elimina EXIF y XMP y apaga sus banderas', () => {
    expect(readMetadata(clean).blocks).toEqual([]);
    const vp8x = indexOfSeq(clean, [...'VP8X'].map((c) => c.charCodeAt(0)));
    expect(clean[vp8x + 8] & 0b1100).toBe(0);
  });

  it('corrige el tamaño del contenedor RIFF', () => {
    expect(new DataView(clean.buffer).getUint32(4, true)).toBe(clean.length - 8);
  });
});

describe('stripMetadata', () => {
  it('rechaza formatos que no conoce', () => {
    expect(() => stripMetadata(new TextEncoder().encode('GIF89a'))).toThrow('Formato no compatible');
  });
});
