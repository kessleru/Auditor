import { type RequestHandler, Router } from 'express';
import type { createAuditDraftsController } from './audit-drafts.controller.js';

/** Auditoria em montagem do auditor da sessão (ADR 0017). */
export function createAuditDraftsRoutes(
  controller: ReturnType<typeof createAuditDraftsController>,
  requireAuditor: RequestHandler,
) {
  const router = Router();
  router.get('/audit-draft', requireAuditor, controller.get);
  router.put('/audit-draft', requireAuditor, controller.save);
  router.patch('/audit-draft/position', requireAuditor, controller.move);
  router.delete('/audit-draft', requireAuditor, controller.discard);
  router.post('/audit-draft/start', requireAuditor, controller.start);
  return router;
}
