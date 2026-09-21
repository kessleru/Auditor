import type { DiscoveryState, DiscoverySummary } from '@auditoria-rf/contracts';
import type { DiscoveryResult } from '../../infra/crawler/index.js';
import { AppError } from '../../shared/errors.js';
import { logger } from '../../shared/logger.js';
import type { InstitutionsService } from '../institutions/institutions.service.js';
import type { RoutesRepository } from './routes.repository.js';

export type DiscoverFn = (domain: string) => Promise<DiscoveryResult>;

interface DiscoveryRun {
  state: DiscoveryState;
  done: Promise<void>;
}

/**
 * Descoberta de rotas em segundo plano, uma por instituição de cada vez. O estado fica em memória:
 * reiniciar o servidor perde só o andamento, nunca rotas já gravadas.
 */
export function createDiscoveryService(
  routesRepo: RoutesRepository,
  institutions: InstitutionsService,
  /** `null` quando o crawler não está configurado (sem e-mail de contato). */
  discover: DiscoverFn | null,
  { now = () => new Date() }: { now?: () => Date } = {},
) {
  const runs = new Map<number, DiscoveryRun>();

  const idle = (institutionId: number): DiscoveryState => ({
    institutionId,
    status: 'idle',
    startedAt: null,
    finishedAt: null,
    error: null,
    summary: null,
  });

  /** Grava as rotas encontradas. Rotas já conhecidas só têm `last_seen_at` atualizado. */
  const persist = (institutionId: number, result: DiscoveryResult): DiscoverySummary => {
    const seenAt = now();
    const functionIds = routesRepo.functionIdsByKey();
    let created = 0;

    routesRepo.transaction(() => {
      for (const route of result.routes) {
        const existing = routesRepo.findByNormalizedUrl(institutionId, route.url);
        if (existing) {
          routesRepo.update(existing.id, {
            lastSeenAt: seenAt,
            // Uma sugestão que agora exige login deixa de ser candidata; decisões do auditor ficam.
            ...(existing.status === 'suggested' &&
              route.status === 'authenticated' && { status: 'authenticated' }),
          });
          continue;
        }
        routesRepo.insert({
          institutionId,
          url: route.url,
          normalizedUrl: route.url,
          functionId: route.suggestedFunction
            ? (functionIds.get(route.suggestedFunction) ?? null)
            : null,
          source: result.source,
          status: route.status,
          exclusionReason: route.exclusionReason ?? null,
          discoveredAt: seenAt,
          lastSeenAt: seenAt,
        });
        created++;
      }
    });

    return {
      source: result.source,
      origin: result.origin,
      robotsTxtFound: result.robotsTxtFound,
      sitemapFiles: result.sitemapFiles.length,
      found: result.routes.length,
      created,
      authenticated: result.routes.filter((r) => r.status === 'authenticated').length,
      excluded: result.routes.filter((r) => r.status === 'excluded').length,
      blockedByRobots: result.blockedByRobots,
      failed: result.failed,
    };
  };

  return {
    get(institutionId: number): DiscoveryState {
      institutions.get(institutionId);
      return runs.get(institutionId)?.state ?? idle(institutionId);
    },

    start(institutionId: number): DiscoveryState {
      const institution = institutions.get(institutionId);
      if (!discover) {
        throw new AppError(
          503,
          'CRAWLER_NOT_CONFIGURED',
          'Defina CRAWLER_CONTACT_EMAIL no .env para identificar a ferramenta aos portais.',
        );
      }
      const run = discover;
      if (!institution.active) {
        throw new AppError(409, 'INSTITUTION_INACTIVE', 'A instituição está inativa.');
      }
      if (runs.get(institutionId)?.state.status === 'running') {
        throw new AppError(
          409,
          'DISCOVERY_RUNNING',
          'Já há uma descoberta em andamento para esta instituição.',
        );
      }

      const state: DiscoveryState = {
        ...idle(institutionId),
        status: 'running',
        startedAt: now().toISOString(),
      };
      const done = (async () => {
        try {
          const result = await run(institution.domain);
          state.summary = persist(institutionId, result);
          state.status = 'completed';
        } catch (err) {
          state.status = 'failed';
          state.error = err instanceof Error ? err.message : String(err);
          logger.warn({ err, institutionId }, 'descoberta de rotas falhou');
        } finally {
          state.finishedAt = now().toISOString();
        }
      })();

      runs.set(institutionId, { state, done });
      return state;
    },

    /** Aguarda a descoberta em andamento terminar (testes e CLI). */
    async waitFor(institutionId: number): Promise<DiscoveryState> {
      await runs.get(institutionId)?.done;
      return this.get(institutionId);
    },
  };
}

export type DiscoveryService = ReturnType<typeof createDiscoveryService>;
