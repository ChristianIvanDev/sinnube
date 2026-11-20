import { describe, expect, it } from 'vitest';
import { classify, summarize } from './network';

describe('classify', () => {
  it('distingue envíos de datos de descargas de la app', () => {
    expect(classify('fetch', 'https://api.ejemplo.com/subir')).toBe('send');
    expect(classify('xmlhttprequest', 'https://ejemplo.com')).toBe('send');
    expect(classify('beacon', 'https://analitica.com')).toBe('send');
    expect(classify('script', 'https://christianivandev.github.io/sinnube/assets/pdf.js')).toBe('asset');
    expect(classify('css', 'https://fonts.googleapis.com/css2')).toBe('asset');
  });

  it('ignora los blob: y data: que se usan para descargar los resultados', () => {
    expect(classify('other', 'blob:https://christianivandev.github.io/123')).toBe('ignore');
    expect(classify('img', 'data:image/png;base64,AAA')).toBe('ignore');
  });
});

describe('summarize', () => {
  const list = [
    { initiatorType: 'script', name: 'https://x/app.js', startTime: 10 },
    { initiatorType: 'fetch', name: 'https://x/antes', startTime: 20 },
    { initiatorType: 'script', name: 'https://x/pdf.js', startTime: 120 },
    { initiatorType: 'img', name: 'blob:https://x/1', startTime: 130 },
  ];

  it('solo cuenta lo que pasó después de agregar archivos', () => {
    expect(summarize(list, 100)).toEqual({ since: 100, sends: [], assets: 1 });
    expect(summarize(list, 0)).toEqual({ since: 0, sends: ['https://x/antes'], assets: 2 });
  });

  it('no cuenta nada si todavía no hay archivos', () => {
    expect(summarize(list, null)).toEqual({ since: null, sends: [], assets: 0 });
  });
});
