import type { CollectionPage } from './collections.js';
import { type PageFailureKind, pageFailureKinds } from './domain.js';

// Confiabilidade da coleta (limitações do estudo): quantas páginas falharam por motivo e quanto
// as avaliadas levaram para carregar. Calculado das páginas, igual na tela e na CLI.

export interface CollectionReliability {
  /** Motivos com ao menos uma página, do mais frequente para o menos. */
  failures: { kind: PageFailureKind; count: number }[];
  /** Tempo de carregamento das páginas avaliadas que o navegador mediu; `null` se nenhuma. */
  loadTime: { measured: number; medianMs: number; maxMs: number } | null;
}

type ReliabilityPage = Pick<CollectionPage, 'status' | 'failureKind' | 'loadTimeMs'>;

export function summarizeReliability(pages: readonly ReliabilityPage[]): CollectionReliability {
  const counts = new Map<PageFailureKind, number>();
  for (const page of pages) {
    if (page.status !== 'failed') continue;
    const kind = page.failureKind ?? 'other';
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  const failures = pageFailureKinds
    .filter((kind) => counts.has(kind))
    .map((kind) => ({ kind, count: counts.get(kind) as number }))
    .sort((a, b) => b.count - a.count);

  const times = pages
    .filter((p) => p.status === 'done' && p.loadTimeMs !== null)
    .map((p) => p.loadTimeMs as number)
    .sort((a, b) => a - b);
  const middle = Math.floor(times.length / 2);
  const loadTime =
    times.length === 0
      ? null
      : {
          measured: times.length,
          medianMs:
            times.length % 2 === 1
              ? (times[middle] as number)
              : Math.round(((times[middle - 1] as number) + (times[middle] as number)) / 2),
          maxMs: times[times.length - 1] as number,
        };
  return { failures, loadTime };
}
