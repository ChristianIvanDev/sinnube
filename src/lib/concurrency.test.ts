import { describe, expect, it } from 'vitest';
import { mapConcurrent } from './concurrency';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('mapConcurrent', () => {
  it('respeta el límite y conserva el orden', async () => {
    let running = 0;
    let peak = 0;
    const out = await mapConcurrent([30, 5, 20, 1, 10, 2], 2, async (ms, i) => {
      running++;
      peak = Math.max(peak, running);
      await sleep(ms);
      running--;
      return i * 10;
    });
    expect(peak).toBe(2);
    expect(out).toEqual([0, 10, 20, 30, 40, 50]);
  });

  it('se detiene al cancelar', async () => {
    const signal = { cancelled: false };
    const started: number[] = [];
    await mapConcurrent(
      [1, 2, 3, 4, 5],
      1,
      async (n) => {
        started.push(n);
        if (n === 2) signal.cancelled = true;
        await sleep(1);
      },
      signal,
    );
    expect(started).toEqual([1, 2]);
  });

  it('funciona con listas vacías', async () => {
    expect(await mapConcurrent([], 3, async () => 1)).toEqual([]);
  });
});
