/**
 * Prueba de privacidad: registra cada petición de red que hace la página (Resource Timing)
 * para mostrar que ningún archivo sale del equipo.
 *
 * Se distinguen dos tipos:
 * - Envíos de datos: fetch, XMLHttpRequest y beacon. Es lo que usaría una web para subir archivos.
 * - Descargas de la propia app: scripts, estilos o fuentes que el navegador baja (por ejemplo,
 *   pdf.js se carga la primera vez que abres un PDF). No envían nada tuyo.
 */

export interface NetworkSummary {
  since: number | null;
  sends: string[];
  assets: number;
}

const SENDING = new Set(['fetch', 'xmlhttprequest', 'beacon']);

type Listener = (s: NetworkSummary) => void;

let since: number | null = null;
let entries: PerformanceResourceTiming[] = [];
const listeners = new Set<Listener>();

/** Clasifica una entrada (función pura, para poder probarla). */
export function classify(initiatorType: string, url: string): 'send' | 'asset' | 'ignore' {
  if (url.startsWith('blob:') || url.startsWith('data:')) return 'ignore';
  return SENDING.has(initiatorType) ? 'send' : 'asset';
}

export function summarize(list: { initiatorType: string; name: string; startTime: number }[], from: number | null): NetworkSummary {
  const after = from === null ? [] : list.filter((e) => e.startTime >= from);
  const sends: string[] = [];
  let assets = 0;
  for (const e of after) {
    const kind = classify(e.initiatorType, e.name);
    if (kind === 'send') sends.push(e.name);
    else if (kind === 'asset') assets++;
  }
  return { since: from, sends, assets };
}

const emit = () => {
  const s = summarize(entries, since);
  listeners.forEach((l) => l(s));
};

export function startNetworkWatch() {
  if (typeof PerformanceObserver === 'undefined') return;
  try {
    new PerformanceObserver((list) => {
      entries = entries.concat(list.getEntries() as PerformanceResourceTiming[]);
      emit();
    }).observe({ type: 'resource', buffered: true });
  } catch {
    /* navegador sin Resource Timing: el indicador simplemente no aparece */
  }
}

/** Se llama la primera vez que el usuario agrega un archivo. */
export function markFilesAdded() {
  if (since !== null) return;
  since = performance.now();
  emit();
}

export function onNetwork(listener: Listener): () => void {
  listeners.add(listener);
  listener(summarize(entries, since));
  return () => listeners.delete(listener);
}
