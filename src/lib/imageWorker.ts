import type { CompressRequest, CompressResponse } from '../workers/compress.worker';
import { defaultConcurrency } from './concurrency';
import { compressImage, type CompressOptions, type CompressResult } from './image';

/**
 * Reparte la compresión entre varios Web Workers. Si el navegador no tiene OffscreenCanvas
 * (o un worker falla al arrancar), se usa el hilo principal: más lento, pero funciona igual.
 */
class CompressPool {
  private workers: Worker[] = [];
  private idle: Worker[] = [];
  private queue: { req: Omit<CompressRequest, 'id'>; resolve: (r: CompressResult) => void; reject: (e: Error) => void }[] = [];
  private pending = new Map<number, { worker: Worker; resolve: (r: CompressResult) => void; reject: (e: Error) => void }>();
  private nextId = 1;
  readonly size: number;

  constructor(size: number) {
    this.size = size;
    for (let i = 0; i < size; i++) {
      const w = new Worker(new URL('../workers/compress.worker.ts', import.meta.url), { type: 'module' });
      w.onmessage = (e: MessageEvent<CompressResponse>) => this.onMessage(w, e.data);
      this.workers.push(w);
      this.idle.push(w);
    }
  }

  run(file: Blob, options: CompressOptions): Promise<CompressResult> {
    return new Promise((resolve, reject) => {
      this.queue.push({ req: { file, options }, resolve, reject });
      this.pump();
    });
  }

  private pump() {
    while (this.idle.length && this.queue.length) {
      const worker = this.idle.pop()!;
      const job = this.queue.shift()!;
      const id = this.nextId++;
      this.pending.set(id, { worker, resolve: job.resolve, reject: job.reject });
      worker.postMessage({ id, ...job.req } satisfies CompressRequest);
    }
  }

  private onMessage(worker: Worker, res: CompressResponse) {
    const job = this.pending.get(res.id);
    if (!job) return;
    this.pending.delete(res.id);
    this.idle.push(worker);
    if (res.ok) job.resolve(res);
    else job.reject(new Error(res.error));
    this.pump();
  }
}

let pool: CompressPool | null | undefined;

function getPool(): CompressPool | null {
  if (pool !== undefined) return pool;
  try {
    pool = typeof OffscreenCanvas !== 'undefined' && typeof Worker !== 'undefined' ? new CompressPool(defaultConcurrency()) : null;
  } catch {
    pool = null;
  }
  return pool;
}

/** Cuántas imágenes conviene procesar a la vez. */
export function compressionLanes(): number {
  return getPool()?.size ?? 1;
}

export async function compress(file: Blob, options: CompressOptions): Promise<CompressResult> {
  const p = getPool();
  if (!p) return compressImage(file, options);
  try {
    return await p.run(file, options);
  } catch (err) {
    // Último recurso: algunos formatos solo se pueden codificar en el canvas normal.
    if (/no puede generar/.test((err as Error).message)) return compressImage(file, options);
    throw err;
  }
}
