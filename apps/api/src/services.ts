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
import { createInstitutionsRepository } from './modules/institutions/institutions.repository.js';
import { createInstitutionsService } from './modules/institutions/institutions.service.js';
import { createReportsRepository } from './modules/reports/reports.repository.js';
import { createPublicReportsService } from './modules/reports/public-reports.service.js';
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

const userAgent = () =>
  env.CRAWLER_CONTACT_EMAIL ? buildUserAgent(env.CRAWLER_CONTACT_EMAIL) : null;

function defaultDiscover(): DiscoverFn | null {
  const ua = userAgent();
  if (!ua) return null;
  const client = createHttpClient({ userAgent: ua });
  return (domain) =>
    discoverRoutes({ domain, client, robotsAgent: ROBOTS_AGENT, maxUrls: env.CRAWLER_MAX_URLS });
}

function defaultAuditor(): PageAuditor | null {
  const ua = userAgent();
  return ua ? createPlaywrightAuditor({ userAgent: ua }) : null;
}

/** Composição dos services. A API (`createApp`) e a CLI usam exatamente esta função. */
export function createServices(db: DB, options: ServiceOptions = {}) {
  const timing = options.clock && { now: options.clock };

  const auth = createAuthService(createAuthRepository(db), timing);
  const institutions = createInstitutionsService(createInstitutionsRepository(db));
  const routesRepository = createRoutesRepository(db);
  const routes = createRoutesService(routesRepository, institutions, timing);
  const discovery = createDiscoveryService(
    routesRepository,
    institutions,
    options.discover === undefined ? defaultDiscover() : options.discover,
    timing,
  );
  const collections = createCollectionsService({
    repo: createCollectionsRepository(db),
    auditor: options.auditor === undefined ? defaultAuditor() : options.auditor,
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

  return { auth, institutions, routes, discovery, collections, reports, publicReports };
}

export type Services = ReturnType<typeof createServices>;
