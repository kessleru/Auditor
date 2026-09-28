import { type RequestHandler, Router } from 'express';
import type { createInspectionsController } from './inspections.controller.js';

/** Camada manual (seção 6 do plano), sempre com sessão de auditor. */
export function createInspectionsRoutes(
  c: ReturnType<typeof createInspectionsController>,
  requireAuditor: RequestHandler,
) {
  const router = Router();
  router.get('/collections/:id/inspection-summary', requireAuditor, c.summary);
  router.put('/collections/:id/inspection-sample', requireAuditor, c.setSample);
  router.get('/collections/:id/institutions/:institutionId/findings', requireAuditor, c.findings);
  router.get(
    '/collections/:id/institutions/:institutionId/incomplete',
    requireAuditor,
    c.incomplete,
  );
  router.patch('/findings/:id/validation', requireAuditor, c.validate);
  router.get('/target-tasks', requireAuditor, c.listTasks);
  router.post('/target-tasks', requireAuditor, c.createTask);
  router.get('/collections/:id/institutions/:institutionId/tasks', requireAuditor, c.tasks);
  router.post('/task-inspections', requireAuditor, c.saveTask);
  router.get(
    '/collections/:id/institutions/:institutionId/assistive-checks',
    requireAuditor,
    c.assistive,
  );
  router.put('/assistive-checks/:pageId/:kind', requireAuditor, c.saveAssistive);
  return router;
}
