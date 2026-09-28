import {
  type CollectionEvent,
  type CollectionScope,
  type CollectionStatus,
  type createCollectionSchema,
  pageFunctionKeys,
  pageFunctionLabels,
} from '@auditoria-rf/contracts';
import type { z } from 'zod';
import { countRules, findingsFromViolations } from '../../infra/auditor/axe-mapping.js';
import { pageConformity } from '../reports/metrics.js';
import { describeFailure, type PageAuditor } from '../../infra/auditor/page-auditor.js';
import type { CollectionEventBus } from '../../infra/events/collection-events.js';
import type { DomainLocks } from '../../infra/locks/domain-locks.js';
import { createWorkerPool } from '../../infra/queue/worker-pool.js';
import type { SnapshotStorage } from '../../infra/storage/snapshot-storage.js';
import { AppError, NotFoundError } from '../../shared/errors.js';
import { logger } from '../../shared/logger.js';
import { toCollectionPage } from './collections.presenter.js';
import { compareRuns, type RetestRun, summarizeRetest } from './retest.js';
import type {
  CollectionPageWithRoute,
  CollectionRow,
  CollectionsRepository,
} from './collections.repository.js';

type CreateCollection = z.output<typeof createCollectionSchema>;

export interface CollectionsServiceDeps {
  repo: CollectionsRepository;
  /**
   * Motor de auditoria, resolvido quando é preciso: o contato do user-agent pode aparecer depois
   * que o servidor subiu. `null` = sem e-mail de contato.
   */
  getAuditor: () => PageAuditor | null;
  storage: SnapshotStorage;
  locks: DomainLocks;
  events: CollectionEventBus;
  concurrency: number;
  now?: () => Date;
}

const FINISHED: readonly CollectionStatus[] = ['completed', 'partial', 'cancelled'];

/**
 * Coletas (seção 3.2 e Fase 4). A fila é `collection_pages` no banco; este service decide o que
 * roda: só inicia uma coleta quando consegue a trava de todos os seus domínios (seção 3.1.8) e
 * nunca processa duas páginas do mesmo host ao mesmo tempo. A API e a CLI usam este mesmo service.
 */
export function createCollectionsService({
  repo,
  getAuditor,
  storage,
  locks,
  events,
  concurrency,
  now = () => new Date(),
}: CollectionsServiceDeps) {
  /** Coletas iniciadas por este processo (a execução não é compartilhada entre processos). */
  const owned = new Set<number>();
  const busyHosts = new Set<string>();
  /** Desligando: nada novo é reivindicado e páginas interrompidas não são marcadas como falha. */
  let stopping = false;
  /** Dono da trava de cada reteste: negativo, para nunca coincidir com o id de uma coleta. */
  let nextRetestOwner = -1;

  /** O último motor usado, para fechar o navegador ao encerrar. */
  let lastAuditor: PageAuditor | null = null;

  const requireAuditor = (): PageAuditor => {
    const auditor = getAuditor();
    if (!auditor) {
      throw new AppError(
        503,
        'CRAWLER_NOT_CONFIGURED',
        'Crie a conta do auditor (o e-mail dele identifica a ferramenta aos portais) ou defina CRAWLER_CONTACT_EMAIL no .env.',
      );
    }
    lastAuditor = auditor;
    return auditor;
  };

  const getCollection = (id: number): CollectionRow => {
    const collection = repo.findCollection(id);
    if (!collection) throw new NotFoundError('Coleta não encontrada.');
    return collection;
  };

  const institutionsOf = (collection: CollectionRow) =>
    repo
      .institutionsByIds(collection.scope.institutionIds)
      .map((i) => ({ id: i.id, acronym: i.acronym, name: i.name }))
      .sort((a, b) => a.acronym.localeCompare(b.acronym));

  const domainsOf = (scope: CollectionScope) =>
    repo.institutionsByIds(scope.institutionIds).map((i) => i.domain);

  /** Algum outro processo já executa coleta num destes domínios? (a trava em memória não vê) */
  const sharesDomainWithRunning = (collection: CollectionRow, domains: readonly string[]) =>
    repo
      .listCollectionsByStatus(['running'])
      .some(
        (other) =>
          other.id !== collection.id && domainsOf(other.scope).some((d) => domains.includes(d)),
      );

  const publish = (collectionId: number, event: CollectionEvent) =>
    events.publish(collectionId, event);

  /** Inicia as coletas da fila que conseguirem a trava de todos os domínios; as demais aguardam. */
  const startQueuedCollections = async () => {
    for (const collection of repo.listCollectionsByStatus(['queued'])) {
      if (owned.has(collection.id)) continue;
      const domains = domainsOf(collection.scope);
      if (!locks.tryAcquire(domains, collection.id)) continue;
      if (sharesDomainWithRunning(collection, domains)) {
        locks.release(collection.id);
        continue;
      }
      let versions: Awaited<ReturnType<PageAuditor['versions']>> | null = null;
      if (!collection.axeVersion) {
        try {
          versions = await requireAuditor().versions();
        } catch (err) {
          // O navegador não abriu: a coleta termina com as páginas em falha e o motivo, em vez
          // de ficar parada na fila (ou derrubar o servidor). "Tentar de novo" a reabre.
          locks.release(collection.id);
          failBeforeStart(collection, err);
          continue;
        }
      }
      repo.updateCollection(collection.id, {
        status: 'running',
        startedAt: collection.startedAt ?? now(),
        ...(versions && {
          axeVersion: versions.axeVersion,
          browserVersion: versions.browserVersion,
          userAgent: versions.userAgent,
        }),
      });
      owned.add(collection.id);
    }
  };

  const failBeforeStart = (collection: CollectionRow, err: unknown) => {
    const error = `Não foi possível iniciar o navegador: ${describeFailure(err, 0)}`;
    logger.error({ err, collectionId: collection.id }, 'coleta não iniciou');
    repo.transaction(() => {
      for (const page of repo.queuedPages([collection.id])) {
        repo.updatePage(page.id, { status: 'failed', error });
      }
      repo.updateCollection(collection.id, {
        status: 'partial',
        startedAt: collection.startedAt ?? now(),
        finishedAt: now(),
      });
    });
    publish(collection.id, {
      type: 'collection-finished',
      status: 'partial',
      progress: repo.progress(collection.id),
    });
  };

  const claim = async (): Promise<CollectionPageWithRoute | null> => {
    if (stopping) return null;
    await startQueuedCollections();
    for (const page of repo.queuedPages([...owned])) {
      const host = new URL(page.url).host;
      if (busyHosts.has(host)) continue;
      if (!repo.claimPage(page.id)) continue;
      busyHosts.add(host);
      return { ...page, status: 'running' };
    }
    return null;
  };

  /** Fecha a coleta quando não há mais nada na fila nem em execução. */
  const maybeFinish = (collectionId: number) => {
    const collection = repo.findCollection(collectionId);
    if (!collection) return;
    const progress = repo.progress(collectionId);
    if (progress.running > 0) return;

    if (collection.status === 'cancelled') {
      locks.release(collectionId);
      owned.delete(collectionId);
      return;
    }
    if (collection.status !== 'running' || progress.queued > 0) return;

    const status: CollectionStatus = progress.failed > 0 ? 'partial' : 'completed';
    repo.updateCollection(collectionId, { status, finishedAt: now() });
    locks.release(collectionId);
    owned.delete(collectionId);
    publish(collectionId, { type: 'collection-finished', status, progress });
  };

  const process = async (page: CollectionPageWithRoute) => {
    const host = new URL(page.url).host;
    try {
      publish(page.collectionId, {
        type: 'page-started',
        pageId: page.id,
        progress: repo.progress(page.collectionId),
      });

      const outcome = await requireAuditor().audit(page.url, { domain: page.domain });
      // Interrompida pelo desligamento: continua `running` e volta para a fila ao reiniciar.
      if (stopping) return;
      if (outcome.ok) {
        const { snapshotPath } = await storage.save(
          page.collectionId,
          page.id,
          outcome.html,
          outcome.results,
        );
        const counts = countRules(outcome.results);
        const drafts = findingsFromViolations(
          outcome.results.violations,
          page.institutionId,
          outcome.elementFacts,
        );
        const inserted = repo.transaction(() => {
          repo.updatePage(page.id, {
            status: 'done',
            httpStatus: outcome.httpStatus,
            error: null,
            snapshotPath,
            passesCount: counts.passes,
            violationsCount: counts.violations,
            incompleteCount: counts.incomplete,
            inapplicableCount: counts.inapplicable,
            evaluatedAt: now(),
            loadTimeMs: outcome.loadTimeMs,
          });
          return repo.insertFindings(page.id, drafts);
        });
        // Fotos são complemento (ADR 0014): se o disco falhar aqui, o achado fica só com o código.
        for (const shot of outcome.screenshots) {
          const finding = inserted.find(
            (f) => f.ruleId === shot.ruleId && f.selector === shot.selector,
          );
          if (!finding) continue;
          try {
            const { screenshotPath } = await storage.saveScreenshot(
              page.collectionId,
              page.id,
              finding.id,
              shot.image,
            );
            repo.setScreenshotPath(finding.id, screenshotPath);
          } catch (err) {
            logger.warn({ err, findingId: finding.id }, 'falha ao gravar a foto do achado');
          }
        }
      } else {
        repo.updatePage(page.id, {
          status: 'failed',
          httpStatus: outcome.httpStatus,
          error: outcome.error,
        });
      }
    } catch (err) {
      if (stopping) return;
      // Erro inesperado (disco, navegador): a página falha, a coleta continua.
      logger.error({ err, pageId: page.id }, 'falha ao auditar página');
      repo.updatePage(page.id, {
        status: 'failed',
        error: `Erro interno: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      busyHosts.delete(host);
    }

    const updated = toCollectionPage(repo.findPage(page.id) as CollectionPageWithRoute);
    publish(page.collectionId, {
      type: updated.status === 'done' ? 'page-done' : 'page-failed',
      page: updated,
      progress: repo.progress(page.collectionId),
    });
    maybeFinish(page.collectionId);
  };

  const pool = createWorkerPool({
    concurrency,
    claim,
    process,
    onError: (err) => logger.error({ err }, 'erro na fila de coleta'),
    onClaimError: (err) => logger.error({ err }, 'erro ao buscar a próxima página da coleta'),
  });

  return {
    /** Cria a coleta com as rotas confirmadas do escopo e a coloca na fila. */
    create(input: CreateCollection, createdBy: number): CollectionRow {
      requireAuditor();
      const found = repo.institutionsByIds(input.institutionIds);
      const missing = input.institutionIds.filter((id) => !found.some((i) => i.id === id));
      if (missing.length > 0)
        throw new NotFoundError(`Instituição não encontrada: ${missing.join(', ')}.`);
      const inactive = found.filter((i) => !i.active);
      if (inactive.length > 0) {
        throw new AppError(
          409,
          'INSTITUTION_INACTIVE',
          `Instituição inativa: ${inactive.map((i) => i.acronym).join(', ')}.`,
        );
      }

      // Escopo sempre explícito: sem `functions`, todas as funções de hoje. Assim a cobertura
      // de cada instituição (encontradas / esperadas) fica gravada com a coleta (ADR 0013).
      const functions = input.functions ?? [...pageFunctionKeys];
      const unreviewed = repo.unreviewedFunctions(input.institutionIds, functions);
      if (unreviewed.length > 0) {
        const names = unreviewed.map((gap) => {
          const acronym = found.find((i) => i.id === gap.institutionId)?.acronym;
          return `${acronym}: ${gap.functions.map((f) => pageFunctionLabels[f]).join(', ')}`;
        });
        throw new AppError(
          422,
          'FUNCTIONS_NOT_REVIEWED',
          `Confirme a rota ou marque como não encontrada: ${names.join('; ')}.`,
          { unreviewed },
        );
      }

      const withoutRoutes = repo.institutionsWithoutRoutes(input.institutionIds, functions);
      if (withoutRoutes.length > 0) {
        const acronyms = found.filter((i) => withoutRoutes.includes(i.id)).map((i) => i.acronym);
        // Sem isso, a instituição apareceria como "sem dado" sem nunca ter sido tentada.
        throw new AppError(
          422,
          'INSTITUTION_WITHOUT_ROUTES',
          `Sem rota confirmada para as funções escolhidas: ${acronyms.join(', ')}. Revise as rotas antes de coletar.`,
          { institutionIds: withoutRoutes },
        );
      }

      const scope: CollectionScope = { institutionIds: input.institutionIds, functions };
      const routes = repo.confirmedRoutes(scope.institutionIds, scope.functions);
      if (routes.length === 0) {
        throw new AppError(
          422,
          'NO_CONFIRMED_ROUTES',
          'Nenhuma rota confirmada no escopo. Confirme as rotas antes de coletar.',
        );
      }

      const collection = repo.transaction(() => {
        const created = repo.insertCollection({ scope, createdBy });
        repo.insertPages(
          created.id,
          routes.map((r) => ({ routeId: r.id, functionId: r.functionId })),
        );
        return created;
      });
      pool.kick();
      return collection;
    },

    get(id: number) {
      const collection = getCollection(id);
      return {
        collection,
        progress: repo.progress(id),
        pages: repo.listPages(id),
        institutions: institutionsOf(collection),
      };
    },

    /** Coletas, das mais recentes para as mais antigas, com progresso e instituições. */
    list(statuses?: readonly CollectionStatus[]) {
      const rows = repo.listCollections(statuses);
      const authors = repo.authorNames(rows.map((c) => c.createdBy));
      return rows.map((collection) => ({
        collection,
        progress: repo.progress(collection.id),
        institutions: institutionsOf(collection),
        createdByName: authors.get(collection.createdBy) ?? '—',
      }));
    },

    getWithProgress(id: number) {
      return { collection: getCollection(id), progress: repo.progress(id) };
    },

    cancel(id: number) {
      const collection = getCollection(id);
      if (FINISHED.includes(collection.status)) {
        throw new AppError(409, 'COLLECTION_FINISHED', 'A coleta já terminou.');
      }
      repo.updateCollection(id, { status: 'cancelled', finishedAt: now() });
      // Páginas já em execução terminam; nenhuma nova é reivindicada. A trava sai em maybeFinish.
      owned.delete(id);
      const progress = repo.progress(id);
      publish(id, { type: 'collection-finished', status: 'cancelled', progress });
      maybeFinish(id);
      pool.kick();
      return { collection: getCollection(id), progress };
    },

    /**
     * Teste-reteste: audita as rotas confirmadas da instituição `rounds` vezes, com o mesmo motor,
     * o mesmo intervalo por host e a mesma trava por domínio da coleta, e compara as rodadas. Nada
     * é gravado: é um indicador de confiabilidade para as limitações do estudo.
     */
    async retest(institutionId: number, rounds = 2) {
      const auditor = requireAuditor();
      const [institution] = repo.institutionsByIds([institutionId]);
      if (!institution) throw new NotFoundError('Instituição não encontrada.');
      const routes = repo.confirmedRoutes([institutionId], [...pageFunctionKeys]);
      if (routes.length === 0) {
        throw new AppError(422, 'NO_CONFIRMED_ROUTES', 'A instituição não tem rota confirmada.');
      }
      // Um dono por chamada: a trava é reentrante para o mesmo dono, e dois retestes da mesma
      // instituição não podem rodar juntos.
      const owner = nextRetestOwner--;
      const busy =
        !locks.tryAcquire([institution.domain], owner) ||
        repo
          .listCollectionsByStatus(['running'])
          .some((c) => domainsOf(c.scope).includes(institution.domain));
      if (busy) {
        locks.release(owner);
        throw new AppError(
          409,
          'DOMAIN_BUSY',
          `Há uma coleta em execução em ${institution.domain}: espere ela terminar.`,
        );
      }
      try {
        const runs = new Map<number, RetestRun[]>(routes.map((r) => [r.id, []]));
        for (let round = 0; round < rounds; round++) {
          for (const route of routes) {
            const outcome = await auditor.audit(route.url, { domain: institution.domain });
            (runs.get(route.id) as RetestRun[]).push(
              outcome.ok
                ? {
                    ok: true,
                    violatedRules: [...new Set(outcome.results.violations.map((v) => v.id))],
                    findings: findingsFromViolations(outcome.results.violations, institutionId).map(
                      (f) => `${f.ruleId}\n${f.selector}`,
                    ),
                    conformity: pageConformity(countRules(outcome.results)),
                  }
                : { ok: false, error: outcome.error },
            );
          }
        }
        const pages = routes.map((route) => {
          const pageRuns = runs.get(route.id) as RetestRun[];
          return {
            url: route.url,
            functionKey: route.functionKey,
            runs: pageRuns,
            ...compareRuns(pageRuns),
          };
        });
        return {
          institution: { id: institution.id, acronym: institution.acronym },
          rounds,
          pages,
          summary: summarizeRetest(pages),
        };
      } finally {
        locks.release(owner);
        // Coleta que esperava por este domínio começa agora.
        pool.kick();
      }
    },

    /** Recoloca na fila uma página que falhou; reabre a coleta se ela já tinha terminado. */
    retryPage(pageId: number) {
      const page = repo.findPage(pageId);
      if (!page) throw new NotFoundError('Página da coleta não encontrada.');
      if (page.status !== 'failed') {
        throw new AppError(
          409,
          'PAGE_NOT_FAILED',
          'Só é possível tentar de novo uma página que falhou.',
        );
      }
      const collection = getCollection(page.collectionId);
      if (collection.status === 'cancelled') {
        throw new AppError(409, 'COLLECTION_CANCELLED', 'A coleta foi cancelada.');
      }
      repo.transaction(() => {
        repo.updatePage(pageId, { status: 'queued', error: null, httpStatus: null });
        if (collection.status === 'completed' || collection.status === 'partial') {
          repo.updateCollection(collection.id, { status: 'queued', finishedAt: null });
        }
      });
      pool.kick();
      return repo.findPage(pageId) as CollectionPageWithRoute;
    },

    subscribe(collectionId: number, listener: (event: CollectionEvent) => void) {
      getCollection(collectionId);
      return events.subscribe(collectionId, listener);
    },

    /** Retomada após reinício do servidor: devolve à fila o que estava em execução e recomeça. */
    resume() {
      repo.resetInterrupted();
      pool.kick();
    },

    /** Resolve quando a coleta termina (CLI e testes). */
    waitForFinish(collectionId: number): Promise<CollectionRow> {
      return new Promise((resolve) => {
        const check = () => {
          const current = getCollection(collectionId);
          if (FINISHED.includes(current.status)) {
            unsubscribe();
            resolve(current);
          }
        };
        const unsubscribe = events.subscribe(collectionId, (event) => {
          if (event.type === 'collection-finished') check();
        });
        check();
      });
    },

    idle: () => pool.idle(),

    /** Encerra aguardando as páginas em execução (CLI). */
    async shutdown() {
      await pool.idle();
      await lastAuditor?.close();
    },

    /** Encerra já (servidor): páginas em execução voltam para a fila na próxima inicialização. */
    async close() {
      stopping = true;
      await lastAuditor?.close();
    },
  };
}

export type CollectionsService = ReturnType<typeof createCollectionsService>;
