import { describe, expect, it } from 'vitest';
import { createWorkerPool } from './worker-pool.js';

describe('createWorkerPool', () => {
  it('respeita a concorrência e processa tudo', async () => {
    const jobs = [1, 2, 3, 4, 5];
    let running = 0;
    let peak = 0;
    const done: number[] = [];

    const pool = createWorkerPool({
      concurrency: 2,
      claim: async () => jobs.shift() ?? null,
      process: async (job) => {
        running++;
        peak = Math.max(peak, running);
        await new Promise((r) => setTimeout(r, 5));
        running--;
        done.push(job);
      },
    });

    pool.kick();
    await pool.idle();
    expect(done.sort()).toEqual([1, 2, 3, 4, 5]);
    expect(peak).toBe(2);
  });

  it('um erro no trabalho não para o pool', async () => {
    const jobs = [1, 2, 3];
    const errors: number[] = [];
    const done: number[] = [];
    const pool = createWorkerPool({
      concurrency: 1,
      claim: async () => jobs.shift() ?? null,
      process: async (job) => {
        if (job === 2) throw new Error('falhou');
        done.push(job);
      },
      onError: (_err, job) => errors.push(job),
    });
    pool.kick();
    await pool.idle();
    expect(done).toEqual([1, 3]);
    expect(errors).toEqual([2]);
  });

  it('erro ao reivindicar vai para onClaimError e não escapa como rejeição', async () => {
    const claimErrors: unknown[] = [];
    const pool = createWorkerPool({
      concurrency: 1,
      claim: async () => {
        throw new Error('banco indisponível');
      },
      process: async () => {},
      onClaimError: (err) => claimErrors.push(err),
    });
    pool.kick();
    await pool.idle();
    expect(claimErrors).toHaveLength(1);
  });

  it('trabalho que chega depois é reivindicado no próximo kick', async () => {
    const jobs: number[] = [];
    const done: number[] = [];
    const pool = createWorkerPool({
      concurrency: 2,
      claim: async () => jobs.shift() ?? null,
      process: async (job) => {
        done.push(job);
      },
    });
    pool.kick();
    await pool.idle();
    jobs.push(7);
    pool.kick();
    await pool.idle();
    expect(done).toEqual([7]);
  });
});
