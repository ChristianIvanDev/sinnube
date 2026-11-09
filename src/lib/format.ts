const UNITS = ['B', 'KB', 'MB', 'GB'];

/** 1536 → «1.5 KB». Usa base 1024, como los exploradores de archivos. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit++;
  }
  const digits = unit === 0 || value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1')} ${UNITS[unit]}`;
}

/** Ahorro entre dos tamaños como porcentaje entero: 1000 → 250 = «−75 %». */
export function formatSaving(before: number, after: number): string {
  if (before <= 0) return '—';
  const pct = Math.round(((after - before) / before) * 100);
  if (pct === 0) return '0 %';
  return `${pct > 0 ? '+' : '−'}${Math.abs(pct)} %`;
}

/** Cambia la extensión de un nombre de archivo: «foto.jpeg» + «webp» → «foto.webp». */
export function withExtension(name: string, ext: string): string {
  const base = name.replace(/\.[^./\\]+$/, '');
  return `${base || 'archivo'}.${ext}`;
}

/** Agrega un sufijo antes de la extensión: «informe.pdf» → «informe-unido.pdf». */
export function withSuffix(name: string, suffix: string): string {
  const m = name.match(/^(.*?)(\.[^./\\]+)?$/)!;
  return `${m[1] || 'archivo'}-${suffix}${m[2] ?? ''}`;
}
