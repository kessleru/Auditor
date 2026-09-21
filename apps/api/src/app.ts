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
import { createAuthRepository } from './modules/auth/auth.repository.js';
import { createAuthRoutes } from './modules/auth/auth.routes.js';
import { createAuthService } from './modules/auth/auth.service.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { createInstitutionsController } from './modules/institutions/institutions.controller.js';
import { createInstitutionsRepository } from './modules/institutions/institutions.repository.js';
import { createInstitutionsRoutes } from './modules/institutions/institutions.routes.js';
import { createInstitutionsService } from './modules/institutions/institutions.service.js';

export interface AppOptions {
  db: DB;
  webOrigin?: string;
  secureCookies?: boolean;
  clock?: () => Date;
}

export function createApp({
  db,
  webOrigin = env.WEB_ORIGIN,
  secureCookies = env.NODE_ENV === 'production',
  clock,
}: AppOptions) {
  const timing = clock && { now: clock };

  const authService = createAuthService(createAuthRepository(db), timing);
  const requireAuditor = requireAuditorFor(authService);

  const institutionsService = createInstitutionsService(createInstitutionsRepository(db));

  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: webOrigin, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  const api = express.Router();
  api.use(healthRoutes);
  api.use(createAuthRoutes(createAuthController(authService, { secureCookies }), requireAuditor));
  api.use(
    createInstitutionsRoutes(createInstitutionsController(institutionsService), requireAuditor),
  );
  app.use('/api/v1', api);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
