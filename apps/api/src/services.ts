import { env } from './config/env.js';
import type { DB } from './db/client.js';
import { createPlaywrightAuditor, type PageAuditor } from './infra/auditor/page-auditor.js';
import {
  buildUserAgent,
  createHttpClient,
  discoverRoutes,
  ROBOTS_AGENT,
} from './infra/crawler/index.js';
import { CollectionEventBus } from './infra/events/collection-events.js';
import { DomainLocks } from './infra/locks/domain-locks.js';
import { createSnapshotStorage } from './infra/storage/snapshot-storage.js';
import { createAuthRepository } from './modules/auth/auth.repository.js';
import { createAuthService } from './modules/auth/auth.service.js';
import { createCollectionsRepository } from './modules/collections/collections.repository.js';
import { createCollectionsService } from './modules/collections/collections.service.js';
import { createInspectionsRepository } from './modules/inspections/inspections.repository.js';
import { createInspectionsService } from './modules/inspections/inspections.service.js';
import { createInstitutionsRepository } from './modules/institutions/institutions.repository.js';
import { createInstitutionsService } from './modules/institutions/institutions.service.js';
import { createReportsRepository } from './modules/reports/reports.repository.js';
import { createExportService } from './modules/reports/export.service.js';
import { createPublicReportsService } from './modules/reports/public-reports.service.js';
import { createResultsService } from './modules/reports/results.service.js';
import { createReportsService } from './modules/reports/reports.service.js';
import {
  createDiscoveryService,
  type DiscoverFn,
} from './modules/routes-discovery/discovery.service.js';
import { createRoutesRepository } from './modules/routes-discovery/routes.repository.js';
import { createRoutesService } from './modules/routes-discovery/routes.service.js';

export interface ServiceOptions {
  clock?: () => Date;
  /** Descoberta de rotas; `null` = crawler não configurado. Padrão: crawler real do env. */
  discover?: DiscoverFn | null;
  /** Motor de auditoria; `null` = não configurado. Padrão: Playwright + axe com o user-agent do env. */
  auditor?: PageAuditor | null;
  snapshotsDir?: string;
  concurrency?: number;
}

/** User-agent da ferramenta: contato do .env ou, sem ele, o e-mail do primeiro auditor. */
export function crawlerUserAgent(
  configured: string | undefined,
  auditors: readonly { email: string }[],
): string | null {
  const contact = configured ?? auditors[0]?.email;
  return contact ? buildUserAgent(contact) : null;
}

/**
 * Guarda o recurso construído para o user-agent atual e só reconstrói se o contato mudar (o
 * anterior é descartado com `dispose`).
 */
function perUserAgent<T>(
  userAgent: () => string | null,
  build: (userAgent: string) => T,
  dispose?: (value: T) => void,
): () => T | null {
  let cache: { userAgent: string; value: T } | null = null;
  return () => {
    const ua = userAgent();
    if (!ua) return null;
    if (cache?.userAgent !== ua) {
      if (cache && dispose) dispose(cache.value);
      cache = { userAgent: ua, value: build(ua) };
    }
    return cache.value;
  };
}

const buildDiscover =
  (ua: string): DiscoverFn =>
  (domain, checkUrls) =>
    discoverRoutes({
      domain,
      client: createHttpClient({ userAgent: ua, proxy: env.CRAWLER_PROXY }),
      robotsAgent: ROBOTS_AGENT,
      maxUrls: env.CRAWLER_MAX_URLS,
      checkUrls,
    });

/** Composição dos services. A API (`createApp`) e a CLI usam exatamente esta função. */
export function createServices(db: DB, options: ServiceOptions = {}) {
  const timing = options.clock && { now: options.clock };

  const auth = createAuthService(createAuthRepository(db), timing);
  // Contato do user-agent (seção 3.1.3): o do .env ou, sem ele, o e-mail do primeiro auditor, o
  // pesquisador responsável. Resolvido a cada uso: o auditor pode ser criado com a API no ar.
  const userAgent = () => crawlerUserAgent(env.CRAWLER_CONTACT_EMAIL, auth.listAuditors());
  const institutions = createInstitutionsService(createInstitutionsRepository(db));
  const routesRepository = createRoutesRepository(db);
  const routes = createRoutesService(routesRepository, institutions, timing);
  const discovery = createDiscoveryService(
    routesRepository,
    institutions,
    options.discover === undefined
      ? perUserAgent(userAgent, buildDiscover)
      : () => options.discover ?? null,
    timing,
  );
  const collections = createCollectionsService({
    repo: createCollectionsRepository(db),
    getAuditor:
      options.auditor === undefined
        ? perUserAgent(
            userAgent,
            (ua) => createPlaywrightAuditor({ userAgent: ua, proxy: env.CRAWLER_PROXY }),
            (old) => void old.close(),
          )
        : () => options.auditor ?? null,
    storage: createSnapshotStorage(options.snapshotsDir ?? env.SNAPSHOTS_DIR),
    locks: new DomainLocks(),
    events: new CollectionEventBus(),
    concurrency: options.concurrency ?? env.COLLECTION_CONCURRENCY,
    ...timing,
  });
  const reportsRepository = createReportsRepository(db);
  const reports = createReportsService(reportsRepository);
  const publicReports = createPublicReportsService(reportsRepository, {
    contactEmail: env.CRAWLER_CONTACT_EMAIL ?? null,
  });

  const inspections = createInspectionsService(createInspectionsRepository(db), timing);
  const results = createResultsService(
    createPublicReportsService(reportsRepository, { contactEmail: null, problems: 'valid' }),
    inspections,
  );
  const exporter = createExportService(publicReports, reportsRepository);

  return {
    auth,
    institutions,
    routes,
    discovery,
    collections,
    reports,
    publicReports,
    inspections,
    results,
    exporter,
  };
}

export type Services = ReturnType<typeof createServices>;
