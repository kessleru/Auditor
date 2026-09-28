import { describe, expect, it } from 'vitest';
import { summarizeReliability } from './reliability.js';

const done = (loadTimeMs: number | null) =>
  ({ status: 'done', failureKind: null, loadTimeMs }) as const;
const failed = (failureKind: 'timeout' | 'http' | 'off_domain' | null) =>
  ({ status: 'failed', failureKind, loadTimeMs: null }) as const;

describe('summarizeReliability', () => {
  it('conta as falhas por motivo, da mais frequente para a menos', () => {
    const { failures } = summarizeReliability([
      failed('http'),
      failed('timeout'),
      failed('timeout'),
      failed('off_domain'),
      done(1000),
      { status: 'queued', failureKind: null, loadTimeMs: null },
    ]);
    expect(failures).toEqual([
      { kind: 'timeout', count: 2 },
      { kind: 'http', count: 1 },
      { kind: 'off_domain', count: 1 },
    ]);
  });

  it('página falha sem motivo conta como outro', () => {
    expect(summarizeReliability([failed(null)]).failures).toEqual([{ kind: 'other', count: 1 }]);
  });

  it('mediana e máximo do carregamento só das páginas avaliadas e medidas', () => {
    expect(summarizeReliability([done(3000), done(1000), done(null), failed('timeout')])).toEqual({
      failures: [{ kind: 'timeout', count: 1 }],
      loadTime: { measured: 2, medianMs: 2000, maxMs: 3000 },
    });
    expect(summarizeReliability([done(500), done(4000), done(900)]).loadTime).toEqual({
      measured: 3,
      medianMs: 900,
      maxMs: 4000,
    });
  });

  it('sem medida, sem tempo de carregamento', () => {
    expect(summarizeReliability([done(null)])).toEqual({ failures: [], loadTime: null });
  });
});
