import { type RequestHandler, Router } from 'express';
import type { createCollectionsController } from './collections.controller.js';

export function createCollectionsRoutes(
  controller: ReturnType<typeof createCollectionsController>,
  requireAuditor: RequestHandler,
) {
  const router = Router();
  router.get('/collections', requireAuditor, controller.list);
  router.post('/collections', requireAuditor, controller.create);
  router.get('/collections/:id', requireAuditor, controller.get);
  router.get('/collections/:id/events', requireAuditor, controller.events);
  router.post('/collections/:id/cancel', requireAuditor, controller.cancel);
  router.post('/collection-pages/:id/retry', requireAuditor, controller.retryPage);
  return router;
}
