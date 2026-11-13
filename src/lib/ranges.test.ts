import { describe, expect, it } from 'vitest';
import { describePages, parseRanges } from './ranges';

const pages = (input: string, total = 10) => parseRanges(input, total).pages.map((p) => p + 1);

describe('parseRanges', () => {
  it('entiende páginas sueltas y rangos', () => {
    expect(pages('1-3, 5')).toEqual([1, 2, 3, 5]);
    expect(pages(' 2 , 4 - 6 ')).toEqual([2, 4, 5, 6]);
    expect(pages('3–5')).toEqual([3, 4, 5]); // guion largo, como lo escribe Word
    expect(pages('3..5')).toEqual([3, 4, 5]);
  });

  it('entiende rangos abiertos', () => {
    expect(pages('8-')).toEqual([8, 9, 10]);
    expect(pages('-3')).toEqual([1, 2, 3]);
  });

  it('permite invertir el orden', () => {
    expect(pages('5-1')).toEqual([5, 4, 3, 2, 1]);
  });

  it('entiende palabras', () => {
    expect(pages('impares', 5)).toEqual([1, 3, 5]);
    expect(pages('pares', 5)).toEqual([2, 4]);
    expect(pages('todas', 3)).toEqual([1, 2, 3]);
    expect(pages('Última', 7)).toEqual([7]);
    expect(pages('5-ultima', 7)).toEqual([5, 6, 7]);
  });

  it('mantiene los grupos separados por comas', () => {
    expect(parseRanges('1-2, 5', 10).groups).toEqual([[0, 1], [4]]);
  });

  it('explica los errores', () => {
    expect(parseRanges('', 10).error).toMatch(/Escribe/);
    expect(parseRanges('12', 10).error).toBe('La página 12 no existe: el documento tiene 10 páginas.');
    expect(parseRanges('0', 1).error).toBe('La página 0 no existe: el documento tiene 1 página.');
    expect(parseRanges('a-b', 10).error).toBe('No entiendo «a-b».');
    expect(parseRanges('1-2-3', 10).error).toBe('No entiendo «1-2-3».');
  });
});

describe('describePages', () => {
  it('resume rangos consecutivos', () => {
    expect(describePages([0, 1, 2, 4, 7, 8])).toBe('1–3, 5, 8, 9');
    expect(describePages([4, 3, 2])).toBe('5, 4, 3');
    expect(describePages([])).toBe('');
  });
});
