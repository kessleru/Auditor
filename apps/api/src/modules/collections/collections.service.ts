import type {
  CollectionEvent,
  CollectionScope,
  CollectionStatus,
  createCollectionSchema,
} from '@auditoria-rf/contracts';
import type { z } from 'zod';
import { countRules, findingsFromViolations } from '../../infra/auditor/axe-mapping.js';
import type { PageAuditor } from '../../infra/auditor/page-auditor.js';
import type { CollectionEventBus } from '../../infra/events/collection-events.js';
import type { DomainLocks } from '../../infra/locks/domain-locks.js';
import { createWorkerPool } from '../../infra/queue/worker-pool.js';
import type { SnapshotStorage } from '../../infra/storage/snapshot-storage.js';
import { AppError, NotFoundError } from '../../shared/errors.js';
import { logger } from '../../shared/logger.js';
import { toCollectionPage } from './collections.presenter.js';
import type {
  CollectionPageWithRoute,
  CollectionRow,
  CollectionsRepository,
} from './collections.repository.js';

type CreateCollection = z.output<typeof createCollectionSchema>;

export interface CollectionsServiceDeps {
  repo: CollectionsRepository;
  /** `null` quando o crawler não está configurado (sem e-mail de contato no user-agent). */
  auditor: PageAuditor | null;
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
  auditor,
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

  const requireAuditor = (): PageAuditor => {
    if (!auditor) {
      throw new AppError(
        503,
        'CRAWLER_NOT_CONFIGURED',
        'Defina CRAWLER_CONTACT_EMAIL no .env para identificar a ferramenta aos portais.',
      );
    }
    return auditor;
  };

  const getCollection = (id: number): CollectionRow => {
    const collection = repo.findCollection(id);
    if (!collection) throw new NotFoundError('Coleta não encontrada.');
    return collection;
  };

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
      const versions = collection.axeVersion ? null : await requireAuditor().versions();
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

      const outcome = await requireAuditor().audit(page.url);
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
        const drafts = findingsFromViolations(outcome.results.violations, page.institutionId);
        repo.transaction(() => {
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
          });
          repo.insertFindings(page.id, drafts);
        });
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

      const scope: CollectionScope = {
        institutionIds: input.institutionIds,
        functions: input.functions ?? null,
      };
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
      return { collection, progress: repo.progress(id), pages: repo.listPages(id) };
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
      await auditor?.close();
    },

    /** Encerra já (servidor): páginas em execução voltam para a fila na próxima inicialização. */
    async close() {
      stopping = true;
      await auditor?.close();
    },
  };
}

export type CollectionsService = ReturnType<typeof createCollectionsService>;
