import { Router } from 'express';
import { CSV_LIMIT, PUBLIC_LIMIT, publicRateLimit } from '../../middlewares/rateLimit.js';
import type { createPublicController } from './public.controller.js';

/** Rotas públicas, sem sessão: somente leitura (seção 6), com limite de requisições por IP. */
export function createPublicRoutes(controller: ReturnType<typeof createPublicController>) {
  const router = Router();
  const csvLimit = publicRateLimit(CSV_LIMIT);
  router.use('/public', publicRateLimit(PUBLIC_LIMIT));
  router.get('/public/summary', controller.summary);
  router.get('/public/institutions', controller.institutions);
  router.get('/public/institutions/:id', controller.institution);
  router.get('/public/institutions/:id/findings', controller.findings);
  router.get('/public/methodology', controller.methodology);
  router.get('/public/export.csv', csvLimit, controller.exportCsv);
  router.get('/public/export-dictionary.csv', csvLimit, controller.dictionary);
  return router;
}
