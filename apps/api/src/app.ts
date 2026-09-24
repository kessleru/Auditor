import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import type { DB } from './db/client.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { notFound } from './middlewares/notFound.js';
import { requireAuditor as requireAuditorFor } from './middlewares/requireAuditor.js';
import { createAuthController } from './modules/auth/auth.controller.js';
import { createAuthRoutes } from './modules/auth/auth.routes.js';
import type { SecureCookies } from './modules/auth/session-cookie.js';
import { createCollectionsController } from './modules/collections/collections.controller.js';
import { createCollectionsRoutes } from './modules/collections/collections.routes.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { createInspectionsController } from './modules/inspections/inspections.controller.js';
import { createInspectionsRoutes } from './modules/inspections/inspections.routes.js';
import { createInstitutionsController } from './modules/institutions/institutions.controller.js';
import { createInstitutionsRoutes } from './modules/institutions/institutions.routes.js';
import { createPublicController } from './modules/reports/public.controller.js';
import { createPublicRoutes } from './modules/reports/public.routes.js';
import { createResultsController } from './modules/reports/results.controller.js';
import { createResultsRoutes } from './modules/reports/results.routes.js';
import { createRoutesDiscoveryController } from './modules/routes-discovery/routes-discovery.controller.js';
import { createRoutesDiscoveryRoutes } from './modules/routes-discovery/routes-discovery.routes.js';
import { createServices, type ServiceOptions, type Services } from './services.js';

export interface AppOptions extends ServiceOptions {
  db: DB;
  webOrigin?: string;
  /** `auto`: `Secure` quando a requisição chegou por HTTPS (ver session-cookie.ts). */
  secureCookies?: SecureCookies;
  /** `trust proxy` do Express (proxy reverso na frente da API). */
  trustProxy?: boolean | number | string;
  sseHeartbeatMs?: number;
  /** Services já compostos (ex.: para o servidor retomar a fila); por padrão, criados aqui. */
  services?: Services;
}

export function createApp({
  db,
  webOrigin = env.WEB_ORIGIN,
  secureCookies = env.COOKIE_SECURE === 'auto' ? 'auto' : env.COOKIE_SECURE === 'true',
  trustProxy = env.TRUST_PROXY,
  sseHeartbeatMs,
  services,
  ...serviceOptions
}: AppOptions) {
  const s = services ?? createServices(db, serviceOptions);
  const requireAuditor = requireAuditorFor(s.auth);

  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', trustProxy);
  app.use(helmet());
  app.use(cors({ origin: webOrigin, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  const api = express.Router();
  api.use(healthRoutes);
  api.use(createPublicRoutes(createPublicController(s.publicReports, s.exporter)));
  api.use(createAuthRoutes(createAuthController(s.auth, { secureCookies }), requireAuditor));
  api.use(createInstitutionsRoutes(createInstitutionsController(s.institutions), requireAuditor));
  api.use(
    createRoutesDiscoveryRoutes(
      createRoutesDiscoveryController(s.discovery, s.routes),
      requireAuditor,
    ),
  );
  api.use(
    createCollectionsRoutes(
      createCollectionsController(s.collections, { heartbeatMs: sseHeartbeatMs }),
      requireAuditor,
    ),
  );
  api.use(createResultsRoutes(createResultsController(s.results), requireAuditor));
  api.use(createInspectionsRoutes(createInspectionsController(s.inspections), requireAuditor));
  app.use('/api/v1', api);

  app.use(notFound);
  app.use(errorHandler);

  return Object.assign(app, { services: s });
}
