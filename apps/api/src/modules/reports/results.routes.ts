import { type RequestHandler, Router } from 'express';
import type { createResultsController } from './results.controller.js';

/** Resultados do auditor (telas 4.1, 4.2, 4.3). */
export function createResultsRoutes(
  c: ReturnType<typeof createResultsController>,
  requireAuditor: RequestHandler,
) {
  const router = Router();
  router.get('/reports/overview', requireAuditor, c.overview);
  router.get('/reports/institutions/:id', requireAuditor, c.institution);
  // Indicadores da pesquisa: validação por regra e acerto da sugestão de função.
  router.get('/reports/indicators', requireAuditor, c.indicators);
  router.get('/reports/indicators/rules.csv', requireAuditor, c.rulesCsv);
  router.get('/reports/indicators/rules-dictionary.csv', requireAuditor, c.rulesDictionary);
  return router;
}
