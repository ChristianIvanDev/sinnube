import { describe, expect, it } from 'vitest';
import { formatBytes, formatSaving, withExtension, withSuffix } from './format';

describe('formatBytes', () => {
  it('elige la unidad adecuada', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(10 * 1024 * 1024)).toBe('10 MB');
    expect(formatBytes(123.4 * 1024 * 1024)).toBe('123 MB');
    expect(formatBytes(2.25 * 1024 ** 3)).toBe('2.25 GB');
  });

  it('no inventa valores con entradas inválidas', () => {
    expect(formatBytes(-1)).toBe('—');
    expect(formatBytes(Number.NaN)).toBe('—');
  });
});

describe('formatSaving', () => {
  it('muestra ahorros y aumentos', () => {
    expect(formatSaving(1000, 250)).toBe('−75 %');
    expect(formatSaving(1000, 1200)).toBe('+20 %');
    expect(formatSaving(1000, 1000)).toBe('0 %');
    expect(formatSaving(0, 10)).toBe('—');
  });
});

describe('nombres de archivo', () => {
  it('cambia la extensión', () => {
    expect(withExtension('foto.jpeg', 'webp')).toBe('foto.webp');
    expect(withExtension('sin-extension', 'png')).toBe('sin-extension.png');
    expect(withExtension('.oculto', 'jpg')).toBe('archivo.jpg');
    expect(withExtension('mis.fotos.de.viaje.JPG', 'webp')).toBe('mis.fotos.de.viaje.webp');
  });

  it('agrega un sufijo antes de la extensión', () => {
    expect(withSuffix('informe.pdf', 'unido')).toBe('informe-unido.pdf');
    expect(withSuffix('notas', 'paginas-1-3')).toBe('notas-paginas-1-3');
  });
});
