import { Router } from 'express';
import type { createPublicController } from './public.controller.js';

/** Rotas públicas, sem sessão: somente leitura (seção 6). */
export function createPublicRoutes(controller: ReturnType<typeof createPublicController>) {
  const router = Router();
  router.get('/public/summary', controller.summary);
  router.get('/public/institutions', controller.institutions);
  router.get('/public/institutions/:id', controller.institution);
  router.get('/public/institutions/:id/findings', controller.findings);
  router.get('/public/methodology', controller.methodology);
  router.get('/public/export.csv', controller.exportCsv);
  router.get('/public/export-dictionary.csv', controller.dictionary);
  return router;
}
