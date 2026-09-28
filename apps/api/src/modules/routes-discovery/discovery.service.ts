import {
  type DiscoveryProgress,
  type DiscoveryState,
  type DiscoverySummary,
  isDiscoveryActive,
  type RouteReplacement,
} from '@auditoria-rf/contracts';
import type { DiscoveryResult } from '../../infra/crawler/index.js';
import { createWorkerPool } from '../../infra/queue/worker-pool.js';
import { isDevHost, isWithinDomain } from '../../infra/crawler/url.js';
import { AppError, NotFoundError } from '../../shared/errors.js';
import { logger } from '../../shared/logger.js';
import type { InstitutionsService } from '../institutions/institutions.service.js';
import type { DiscoveryRun, DiscoveryRunsRepository } from './discovery-runs.repository.js';
import type { RoutesRepository } from './routes.repository.js';

/**
 * Executa a descoberta; `checkUrls` são as rotas confirmadas a verificar (seção 3.1.7) e
 * `onProgress` recebe o andamento (etapa e páginas lidas).
 */
export type DiscoverFn = (
  domain: string,
  checkUrls: string[],
  onProgress?: (progress: DiscoveryProgress) => void,
) => Promise<DiscoveryResult>;

const NOT_CONFIGURED =
  'Crie a conta do auditor (o e-mail dele identifica a ferramenta aos portais) ou defina CRAWLER_CONTACT_EMAIL no .env.';

/**
 * Descoberta de rotas em segundo plano (ADR 0017). A fila fica no banco (`discovery_runs`), como a
 * da coleta: o auditor pode sair da tela, e o que estava na fila ou em execução quando a API parou
 * recomeça ao reiniciar. Uma rodada por instituição de cada vez; o intervalo por host (3.1.3)
 * continua valendo entre instituições que rodam ao mesmo tempo.
 */
export function createDiscoveryService(
  routesRepo: RoutesRepository,
  runsRepo: DiscoveryRunsRepository,
  institutions: InstitutionsService,
  /**
   * Resolvida a cada descoberta: o contato do user-agent pode aparecer depois que o servidor
   * subiu (ex.: o launcher cria o auditor com a API no ar). `null` = sem contato.
   */
  getDiscover: () => DiscoverFn | null,
  { now = () => new Date(), concurrency = 2 }: { now?: () => Date; concurrency?: number } = {},
) {
  /** Desligando: nada novo é pego e a rodada interrompida volta para a fila ao reiniciar. */
  let stopping = false;
  /** Quem espera alguma rodada terminar (CLI e testes). */
  const waiters = new Set<() => void>();

  const idle = (institutionId: number): DiscoveryState => ({
    institutionId,
    status: 'idle',
    progress: null,
    queuedAt: null,
    startedAt: null,
    finishedAt: null,
    error: null,
    summary: null,
    replacements: [],
  });

  const toState = (run: DiscoveryRun): DiscoveryState => ({
    institutionId: run.institutionId,
    status: run.status,
    progress: run.status === 'running' ? run.progress : null,
    queuedAt: run.createdAt.toISOString(),
    startedAt: run.startedAt?.toISOString() ?? null,
    finishedAt: run.finishedAt?.toISOString() ?? null,
    error: run.error,
    summary: run.summary,
    replacements: run.replacements,
  });

  const stateOf = (institutionId: number) => {
    const run = runsRepo.latest([institutionId]).get(institutionId);
    return run ? toState(run) : idle(institutionId);
  };

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
      offDomainHost: result.offDomainHost,
    };
  };

  /**
   * Rotas confirmadas que não respondem mais (404/410) ou mudaram de endereço (301/308), com uma
   * candidata: o destino do redirecionamento ou outra rota sugerida para a mesma função. Nada é
   * aplicado: a substituição exige confirmação do auditor.
   */
  const findReplacements = (
    institutionId: number,
    domain: string,
    result: DiscoveryResult,
  ): RouteReplacement[] => {
    const seenAt = now();
    const replacements: RouteReplacement[] = [];
    for (const check of result.checks) {
      if (check.result !== 'not_found' && check.result !== 'moved') continue;
      const route = routesRepo.findByNormalizedUrl(institutionId, check.url);
      if (!route || route.status !== 'confirmed') continue;

      // Destino em outro domínio (ou em homologação) não vira rota da instituição: a mudança
      // aparece, mas a candidata vem das sugestões da mesma função.
      const movedTo =
        check.movedTo !== null &&
        isWithinDomain(new URL(check.movedTo).host, domain) &&
        !isDevHost(new URL(check.movedTo).host)
          ? check.movedTo
          : null;
      let candidate =
        movedTo !== null ? routesRepo.findByNormalizedUrl(institutionId, movedTo) : undefined;
      if (!candidate && movedTo !== null) {
        candidate = routesRepo.insert({
          institutionId,
          url: movedTo,
          normalizedUrl: movedTo,
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

  /** Lê o portal e grava o resultado da rodada; erro vira falha registrada, nunca exceção. */
  const execute = async (run: DiscoveryRun) => {
    try {
      const institution = institutions.get(run.institutionId);
      const discover = getDiscover();
      if (!discover) throw new Error(NOT_CONFIGURED);
      const confirmed = routesRepo
        .listByInstitution(run.institutionId, 'confirmed')
        .map((r) => r.url);
      const result = await discover(institution.domain, confirmed, (progress) => {
        if (!stopping) runsRepo.setProgress(run.id, progress);
      });
      // Interrompida pelo desligamento: continua `running` e volta para a fila ao reiniciar.
      if (stopping) return;
      const summary = persist(run.institutionId, result);
      const replacements = findReplacements(run.institutionId, institution.domain, result);
      runsRepo.complete(run.id, { summary, replacements, at: now() });
    } catch (err) {
      if (stopping) return;
      runsRepo.fail(run.id, err instanceof Error ? err.message : String(err), now());
      logger.warn({ err, institutionId: run.institutionId }, 'descoberta de rotas falhou');
    } finally {
      for (const notify of [...waiters]) notify();
    }
  };

  const pool = createWorkerPool<DiscoveryRun>({
    concurrency,
    claim: async () => (stopping ? null : runsRepo.claimNext(now())),
    process: execute,
    onError: (err) => logger.error({ err }, 'erro na fila da descoberta'),
    onClaimError: (err) => logger.error({ err }, 'erro ao buscar a próxima descoberta'),
  });

  /** Checagens comuns: instituição existe e está ativa, crawler configurado, nada em andamento. */
  const assertCanStart = (institutionId: number) => {
    const institution = institutions.get(institutionId);
    if (!getDiscover()) throw new AppError(503, 'CRAWLER_NOT_CONFIGURED', NOT_CONFIGURED);
    if (!institution.active) {
      throw new AppError(409, 'INSTITUTION_INACTIVE', 'A instituição está inativa.');
    }
    if (isDiscoveryActive(stateOf(institutionId).status)) {
      throw new AppError(
        409,
        'DISCOVERY_RUNNING',
        'Já há uma descoberta na fila ou em andamento para esta instituição.',
      );
    }
    return institution;
  };

  const enqueue = (institutionId: number, requestedBy: number | null) => {
    runsRepo.insert({ institutionId, requestedBy, status: 'queued', at: now() });
  };

  const requireInstitutions = (institutionIds: readonly number[]) => {
    const known = new Set(institutions.list().map((i) => i.id));
    const missing = institutionIds.filter((id) => !known.has(id));
    if (missing.length > 0) {
      throw new NotFoundError(`Instituição não encontrada: ${missing.join(', ')}.`);
    }
  };

  const list = (institutionIds: readonly number[]): DiscoveryState[] => {
    requireInstitutions(institutionIds);
    const latest = runsRepo.latest(institutionIds);
    return institutionIds.map((id) => {
      const run = latest.get(id);
      return run ? toState(run) : idle(id);
    });
  };

  return {
    /** A substituição foi decidida pelo auditor: some da lista de pendências. */
    resolveReplacement(institutionId: number, routeId: number) {
      const run = runsRepo.latest([institutionId]).get(institutionId);
      if (!run || run.replacements.every((r) => r.routeId !== routeId)) return;
      runsRepo.setReplacements(
        run.id,
        run.replacements.filter((r) => r.routeId !== routeId),
      );
    },

    get(institutionId: number): DiscoveryState {
      institutions.get(institutionId);
      return stateOf(institutionId);
    },

    /** Situação da descoberta de várias instituições (visão geral da revisão de rotas). */
    list,

    /** Põe a instituição na fila; a descoberta roda em segundo plano. */
    start(institutionId: number, requestedBy: number | null = null): DiscoveryState {
      assertCanStart(institutionId);
      enqueue(institutionId, requestedBy);
      pool.kick();
      return stateOf(institutionId);
    },

    /**
     * Descoberta em lote: põe na fila as instituições pedidas que estão ativas e sem descoberta
     * em andamento; as demais ficam como estão.
     */
    startMany(institutionIds: readonly number[], requestedBy: number | null): DiscoveryState[] {
      requireInstitutions(institutionIds);
      if (!getDiscover()) throw new AppError(503, 'CRAWLER_NOT_CONFIGURED', NOT_CONFIGURED);
      const latest = runsRepo.latest(institutionIds);
      const active = new Set(
        institutions
          .list()
          .filter((i) => i.active)
          .map((i) => i.id),
      );
      for (const id of institutionIds) {
        const run = latest.get(id);
        if (active.has(id) && !(run && isDiscoveryActive(run.status))) enqueue(id, requestedBy);
      }
      pool.kick();
      return list(institutionIds);
    },

    /**
     * Instituições do escopo que nunca foram olhadas (sem rota, sem função marcada como não
     * encontrada e sem descoberta) entram na fila sozinhas: é o primeiro passo da revisão. As que
     * falharam ou já têm rotas só são descobertas de novo a pedido do auditor.
     */
    startMissing(institutionIds: readonly number[], requestedBy: number | null): number[] {
      if (!getDiscover()) return [];
      const withRuns = runsRepo.institutionsWithRuns(institutionIds);
      const active = new Set(
        institutions
          .list()
          .filter((i) => i.active)
          .map((i) => i.id),
      );
      const missing = institutionIds.filter(
        (id) =>
          active.has(id) &&
          !withRuns.has(id) &&
          routesRepo.listByInstitution(id).length === 0 &&
          routesRepo.listAbsences(id).length === 0,
      );
      for (const id of missing) enqueue(id, requestedBy);
      if (missing.length > 0) pool.kick();
      return missing;
    },

    /**
     * Descoberta imediata, fora da fila (CLI): mesma execução e mesmo registro da rodada, sem
     * pegar as rodadas que a API pôs na fila.
     */
    async runNow(institutionId: number): Promise<DiscoveryState> {
      assertCanStart(institutionId);
      const run = runsRepo.insert({
        institutionId,
        requestedBy: null,
        status: 'running',
        at: now(),
      });
      await execute(run);
      return stateOf(institutionId);
    },

    /** Aguarda a descoberta da instituição sair da fila e terminar (testes). */
    async waitFor(institutionId: number): Promise<DiscoveryState> {
      for (;;) {
        institutions.get(institutionId);
        const state = stateOf(institutionId);
        if (!isDiscoveryActive(state.status)) return state;
        await new Promise<void>((resolve) => {
          const done = () => {
            waiters.delete(done);
            resolve();
          };
          waiters.add(done);
        });
      }
    },

    /** Retomada após reinício: rodadas interrompidas voltam para a fila e a fila recomeça. */
    resume() {
      runsRepo.resetInterrupted();
      pool.kick();
    },

    idle: () => pool.idle(),

    /** Encerra já (servidor): a rodada em execução recomeça na próxima inicialização. */
    close() {
      stopping = true;
    },
  };
}

export type DiscoveryService = ReturnType<typeof createDiscoveryService>;
