/**
 * Ejecuta `task` sobre cada elemento con, como mucho, `limit` tareas a la vez.
 * Devuelve los resultados en el mismo orden de entrada. Se puede cancelar con `signal`:
 * las tareas en curso terminan, pero no empiezan nuevas.
 */
export async function mapConcurrent<T, R>(
  items: T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>,
  signal?: { cancelled: boolean },
): Promise<(R | undefined)[]> {
  const results: (R | undefined)[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length && !signal?.cancelled) {
      const i = next++;
      results[i] = await task(items[i], i);
    }
  };
  const lanes = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: lanes }, worker));
  return results;
}

/** Hilos razonables: deja uno libre para la interfaz y no pasa de 4 para no agotar la memoria. */
export function defaultConcurrency(): number {
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 2 : 2;
  return Math.max(1, Math.min(4, cores - 1));
}
