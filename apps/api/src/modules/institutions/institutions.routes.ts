import { type RequestHandler, Router } from 'express';
import type { createInstitutionsController } from './institutions.controller.js';

export function createInstitutionsRoutes(
  controller: ReturnType<typeof createInstitutionsController>,
  requireAuditor: RequestHandler,
) {
  const router = Router();
  router.get('/institutions', requireAuditor, controller.list);
  router.post('/institutions', requireAuditor, controller.create);
  router.get('/institutions/:id', requireAuditor, controller.get);
  router.patch('/institutions/:id', requireAuditor, controller.update);
  return router;
}
