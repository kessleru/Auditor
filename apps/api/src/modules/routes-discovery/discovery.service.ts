import type { DiscoveryState, DiscoverySummary, RouteReplacement } from '@auditoria-rf/contracts';
import type { DiscoveryResult } from '../../infra/crawler/index.js';
import { AppError } from '../../shared/errors.js';
import { logger } from '../../shared/logger.js';
import type { InstitutionsService } from '../institutions/institutions.service.js';
import type { RoutesRepository } from './routes.repository.js';

/** Executa a descoberta; `checkUrls` são as rotas confirmadas a verificar (seção 3.1.7). */
export type DiscoverFn = (domain: string, checkUrls: string[]) => Promise<DiscoveryResult>;

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
  /**
   * Resolvida a cada descoberta: o contato do user-agent pode aparecer depois que o servidor
   * subiu (ex.: o launcher cria o auditor com a API no ar). `null` = sem contato.
   */
  getDiscover: () => DiscoverFn | null,
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
    replacements: [],
  });

  /** Grava as rotas encontradas. Rotas já conhecidas só têm `last_seen_at` atualizado. */
  const persist = (institutionId: number, result: DiscoveryResult): DiscoverySummary => {
    const seenAt = now();
    const functionIds = routesRepo.functionIdsByKey();
    let created = 0;

    routesRepo.transaction(() => {
      for (const route of result.routes) {
        const existing = routesRepo.findByNormalizedUrl(institutionId, route.url);
        const suggestedId = route.suggestedFunction
          ? (functionIds.get(route.suggestedFunction) ?? null)
          : null;
        // Indícios da descoberta: atualizados a cada rodada, nunca mudam decisões do auditor. A
        // relevância é da sugestão; se a função gravada é outra, a relevância antiga fica.
        const evidence = {
          title: route.title ?? existing?.title ?? null,
          linkText: route.linkText ?? existing?.linkText ?? null,
          relevance:
            !existing || existing.functionId === suggestedId ? route.relevance : existing.relevance,
        };
        if (existing) {
          routesRepo.update(existing.id, {
            lastSeenAt: seenAt,
            ...evidence,
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
          functionId: suggestedId,
          source: route.source,
          status: route.status,
          exclusionReason: route.exclusionReason ?? null,
          discoveredAt: seenAt,
          lastSeenAt: seenAt,
          ...evidence,
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
      withSuggestion: result.routes.filter(
        (r) => r.status === 'suggested' && r.suggestedFunction !== null,
      ).length,
      blockedByRobots: result.blockedByRobots,
      failed: result.failed,
      stoppedEarly: result.stoppedEarly,
    };
  };

  /**
   * Rotas confirmadas que não respondem mais (404/410) ou mudaram de endereço (301/308), com uma
   * candidata: o destino do redirecionamento ou outra rota sugerida para a mesma função. Nada é
   * aplicado: a substituição exige confirmação do auditor.
   */
  const findReplacements = (institutionId: number, result: DiscoveryResult): RouteReplacement[] => {
    const seenAt = now();
    const replacements: RouteReplacement[] = [];
    for (const check of result.checks) {
      if (check.result !== 'not_found' && check.result !== 'moved') continue;
      const route = routesRepo.findByNormalizedUrl(institutionId, check.url);
      if (!route || route.status !== 'confirmed') continue;

      let candidate =
        check.movedTo !== null
          ? routesRepo.findByNormalizedUrl(institutionId, check.movedTo)
          : undefined;
      if (!candidate && check.movedTo !== null) {
        candidate = routesRepo.insert({
          institutionId,
          url: check.movedTo,
          normalizedUrl: check.movedTo,
          source: result.source,
          status: 'suggested',
          discoveredAt: seenAt,
          lastSeenAt: seenAt,
        });
      }
      if (!candidate && route.functionId !== null) {
        candidate = routesRepo
          .listByInstitution(institutionId, 'suggested')
          .find((r) => r.functionId === route.functionId && r.id !== route.id);
      }

      const withFunction = routesRepo.findById(route.id);
      replacements.push({
        routeId: route.id,
        url: route.url,
        functionKey: withFunction?.functionKey ?? null,
        reason: check.result,
        httpStatus: check.httpStatus,
        candidateRouteId: candidate?.id ?? null,
        candidateUrl: candidate?.url ?? null,
      });
    }
    return replacements;
  };

  return {
    /** A substituição foi decidida pelo auditor: some da lista de pendências. */
    resolveReplacement(institutionId: number, routeId: number) {
      const state = runs.get(institutionId)?.state;
      if (state) state.replacements = state.replacements.filter((r) => r.routeId !== routeId);
    },

    get(institutionId: number): DiscoveryState {
      institutions.get(institutionId);
      return runs.get(institutionId)?.state ?? idle(institutionId);
    },

    start(institutionId: number): DiscoveryState {
      const institution = institutions.get(institutionId);
      const run = getDiscover();
      if (!run) {
        throw new AppError(
          503,
          'CRAWLER_NOT_CONFIGURED',
          'Crie a conta do auditor (o e-mail dele identifica a ferramenta aos portais) ou defina CRAWLER_CONTACT_EMAIL no .env.',
        );
      }
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
          const confirmed = routesRepo
            .listByInstitution(institutionId, 'confirmed')
            .map((r) => r.url);
          const result = await run(institution.domain, confirmed);
          state.summary = persist(institutionId, result);
          state.replacements = findReplacements(institutionId, result);
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
