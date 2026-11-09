import { describe, expect, it } from 'vitest';
import { sniffBytes } from './sniff';

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(parts.flatMap((p) => (typeof p === 'string' ? [...p].map((c) => c.charCodeAt(0)) : p)));

describe('sniffBytes', () => {
  it('reconoce cada formato por su firma', () => {
    expect(sniffBytes(bytes('%PDF-1.7\n'))).toBe('pdf');
    expect(sniffBytes(bytes([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]))).toBe('jpeg');
    expect(sniffBytes(bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe('png');
    expect(sniffBytes(bytes('RIFF', [0x24, 0, 0, 0], 'WEBPVP8 '))).toBe('webp');
    expect(sniffBytes(bytes('GIF89a'))).toBe('gif');
    expect(sniffBytes(bytes([0, 0, 0, 0x1c], 'ftypavif'))).toBe('avif');
  });

  it('acepta PDF con bytes antes de la cabecera', () => {
    expect(sniffBytes(bytes([0xef, 0xbb, 0xbf], 'basura\r\n%PDF-1.4'))).toBe('pdf');
  });

  it('no se deja engañar por la extensión: un texto no es una imagen', () => {
    expect(sniffBytes(bytes('Hola, no soy un JPG'))).toBe('unknown');
    expect(sniffBytes(bytes([1, 2]))).toBe('unknown');
  });
});
