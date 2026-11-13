/**
 * Interpreta selecciones de páginas como las escribe una persona:
 *   «1-3, 5, 8-»   → 1, 2, 3, 5, 8 … hasta la última
 *   «-3»           → 1, 2, 3
 *   «10-1»         → del 10 al 1, en orden inverso
 *   «impares», «pares», «todas», «última»
 * Devuelve grupos (uno por cada parte separada por comas) con índices desde 0.
 */
export interface RangeResult {
  groups: number[][];
  pages: number[];
  error?: string;
}

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

export function parseRanges(input: string, total: number): RangeResult {
  const parts = input
    .split(/[,;]/)
    .map((p) => norm(p).replace(/\s+/g, '').replace(/[–—]/g, '-').replace(/\.\./g, '-'))
    .filter(Boolean);
  if (parts.length === 0) return { groups: [], pages: [], error: 'Escribe qué páginas quieres, por ejemplo «1-3, 5».' };

  const groups: number[][] = [];
  for (const part of parts) {
    const group = parsePart(part, total);
    if (typeof group === 'string') return { groups: [], pages: [], error: group };
    groups.push(group);
  }
  return { groups, pages: groups.flat() };
}

function parsePart(part: string, total: number): number[] | string {
  const all = Array.from({ length: total }, (_, i) => i);
  if (part === 'todas' || part === 'todo') return all;
  if (part === 'impares') return all.filter((i) => i % 2 === 0);
  if (part === 'pares') return all.filter((i) => i % 2 === 1);

  const num = (s: string): number | null => {
    if (s === '') return null;
    if (s === 'ultima' || s === 'fin' || s === 'final') return total;
    if (!/^\d+$/.test(s)) return NaN;
    return Number(s);
  };

  const m = part.match(/^([^-]*)-([^-]*)$/);
  if (m) {
    const from = num(m[1]) ?? 1;
    const to = num(m[2]) ?? total;
    if (Number.isNaN(from) || Number.isNaN(to)) return `No entiendo «${part}».`;
    const bad = [from, to].find((n) => n < 1 || n > total);
    if (bad !== undefined) return outOfRange(bad, total);
    const step = from <= to ? 1 : -1;
    const out: number[] = [];
    for (let p = from; p !== to + step; p += step) out.push(p - 1);
    return out;
  }

  const single = num(part);
  if (single === null || Number.isNaN(single)) return `No entiendo «${part}».`;
  if (single < 1 || single > total) return outOfRange(single, total);
  return [single - 1];
}

function outOfRange(n: number, total: number) {
  return `La página ${n} no existe: el documento tiene ${total} ${total === 1 ? 'página' : 'páginas'}.`;
}

/** Resume una lista de índices como texto legible: [0,1,2,4] → «1–3, 5». */
export function describePages(pages: number[]): string {
  const out: string[] = [];
  let i = 0;
  while (i < pages.length) {
    let j = i;
    while (j + 1 < pages.length && pages[j + 1] === pages[j] + 1) j++;
    out.push(j - i >= 2 ? `${pages[i] + 1}–${pages[j] + 1}` : pages.slice(i, j + 1).map((p) => p + 1).join(', '));
    i = j + 1;
  }
  return out.join(', ');
}
