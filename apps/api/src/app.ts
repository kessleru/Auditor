import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { notFound } from './middlewares/notFound.js';
import { healthRoutes } from './modules/health/health.routes.js';

export interface AppOptions {
  webOrigin?: string;
}

export function createApp({ webOrigin = env.WEB_ORIGIN }: AppOptions = {}) {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: webOrigin, credentials: true }));
  app.use(express.json({ limit: '100kb' }));

  const api = express.Router();
  api.use(healthRoutes);
  app.use('/api/v1', api);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
