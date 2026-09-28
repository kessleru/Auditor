import type {
  DiscoveryProgress,
  DiscoveryRunStatus,
  DiscoverySummary,
  RouteReplacement,
} from '@auditoria-rf/contracts';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import type { DB } from '../../db/client.js';
import { discoveryRuns } from '../../db/schema.js';

type RunRow = typeof discoveryRuns.$inferSelect;

/** Rodada da descoberta com os campos JSON já tipados. */
export interface DiscoveryRun {
  id: number;
  institutionId: number;
  status: DiscoveryRunStatus;
  requestedBy: number | null;
  progress: DiscoveryProgress | null;
  summary: DiscoverySummary | null;
  replacements: RouteReplacement[];
  error: string | null;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
}

const toRun = (row: RunRow): DiscoveryRun => ({
  id: row.id,
  institutionId: row.institutionId,
  status: row.status,
  requestedBy: row.requestedBy,
  progress: (row.progressJson as DiscoveryProgress | null) ?? null,
  summary: (row.summaryJson as DiscoverySummary | null) ?? null,
  replacements: (row.replacementsJson as RouteReplacement[] | null) ?? [],
  error: row.error,
  createdAt: row.createdAt,
  startedAt: row.startedAt,
  finishedAt: row.finishedAt,
});

/** Andamento com que toda rodada começa: lendo o robots.txt e a página inicial. */
export const INITIAL_PROGRESS: DiscoveryProgress = { phase: 'robots', visited: 0, planned: null };

export function createDiscoveryRunsRepository(db: DB) {
  return {
    insert(values: {
      institutionId: number;
      requestedBy: number | null;
      status: 'queued' | 'running';
      at: Date;
    }): DiscoveryRun {
      const running = values.status === 'running';
      return toRun(
        db
          .insert(discoveryRuns)
          .values({
            institutionId: values.institutionId,
            requestedBy: values.requestedBy,
            status: values.status,
            createdAt: values.at,
            startedAt: running ? values.at : null,
            progressJson: running ? INITIAL_PROGRESS : null,
          })
          .returning()
          .get(),
      );
    },

    /** Última rodada de cada instituição pedida (a mais recente, pelo id). */
    latest(institutionIds: readonly number[]): Map<number, DiscoveryRun> {
      const latest = new Map<number, DiscoveryRun>();
      if (institutionIds.length === 0) return latest;
      const rows = db
        .select()
        .from(discoveryRuns)
        .where(inArray(discoveryRuns.institutionId, [...institutionIds]))
        .orderBy(desc(discoveryRuns.id))
        .all();
      for (const row of rows)
        if (!latest.has(row.institutionId)) latest.set(row.institutionId, toRun(row));
      return latest;
    },

    /** Instituições que já tiveram alguma rodada, entre as pedidas. */
    institutionsWithRuns(institutionIds: readonly number[]): Set<number> {
      if (institutionIds.length === 0) return new Set();
      return new Set(
        db
          .select({ institutionId: discoveryRuns.institutionId })
          .from(discoveryRuns)
          .where(inArray(discoveryRuns.institutionId, [...institutionIds]))
          .all()
          .map((r) => r.institutionId),
      );
    },

    /**
     * Pega a rodada mais antiga da fila e a marca como em execução, numa transação: dois
     * trabalhadores nunca pegam a mesma.
     */
    claimNext(at: Date): DiscoveryRun | null {
      return db.transaction((tx) => {
        const next = tx
          .select()
          .from(discoveryRuns)
          .where(eq(discoveryRuns.status, 'queued'))
          .orderBy(asc(discoveryRuns.id))
          .get();
        if (!next) return null;
        const claimed = tx
          .update(discoveryRuns)
          .set({ status: 'running', startedAt: at, progressJson: INITIAL_PROGRESS })
          .where(and(eq(discoveryRuns.id, next.id), eq(discoveryRuns.status, 'queued')))
          .returning()
          .get();
        return claimed ? toRun(claimed) : null;
      });
    },

    setProgress(id: number, progress: DiscoveryProgress) {
      db.update(discoveryRuns)
        .set({ progressJson: progress })
        .where(and(eq(discoveryRuns.id, id), eq(discoveryRuns.status, 'running')))
        .run();
    },

    complete(
      id: number,
      values: { summary: DiscoverySummary; replacements: RouteReplacement[]; at: Date },
    ) {
      db.update(discoveryRuns)
        .set({
          status: 'completed',
          summaryJson: values.summary,
          replacementsJson: values.replacements,
          progressJson: null,
          error: null,
          finishedAt: values.at,
        })
        .where(eq(discoveryRuns.id, id))
        .run();
    },

    fail(id: number, error: string, at: Date) {
      db.update(discoveryRuns)
        .set({ status: 'failed', error, progressJson: null, finishedAt: at })
        .where(eq(discoveryRuns.id, id))
        .run();
    },

    setReplacements(id: number, replacements: RouteReplacement[]) {
      db.update(discoveryRuns)
        .set({ replacementsJson: replacements })
        .where(eq(discoveryRuns.id, id))
        .run();
    },

    /** Retomada após reinício: o que estava em execução volta para a fila e começa de novo. */
    resetInterrupted() {
      db.update(discoveryRuns)
        .set({ status: 'queued', startedAt: null, progressJson: null })
        .where(eq(discoveryRuns.status, 'running'))
        .run();
    },
  };
}

export type DiscoveryRunsRepository = ReturnType<typeof createDiscoveryRunsRepository>;
