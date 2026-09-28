import { type RequestHandler, Router } from 'express';
import type { createRoutesDiscoveryController } from './routes-discovery.controller.js';

export function createRoutesDiscoveryRoutes(
  controller: ReturnType<typeof createRoutesDiscoveryController>,
  requireAuditor: RequestHandler,
) {
  const router = Router();
  router.post('/institutions/:id/discover', requireAuditor, controller.startDiscovery);
  router.get('/institutions/:id/discovery', requireAuditor, controller.getDiscovery);
  router.get('/discoveries', requireAuditor, controller.listDiscoveries);
  router.post('/discoveries', requireAuditor, controller.startDiscoveries);
  router.get('/institutions/:id/routes', requireAuditor, controller.listRoutes);
  router.post('/institutions/:id/routes', requireAuditor, controller.createRoute);
  router.patch('/routes/:id', requireAuditor, controller.updateRoute);
  router.post('/routes/:id/replace', requireAuditor, controller.replaceRoute);
  router.put(
    '/institutions/:id/functions/:functionKey/absence',
    requireAuditor,
    controller.markAbsent,
  );
  router.delete(
    '/institutions/:id/functions/:functionKey/absence',
    requireAuditor,
    controller.clearAbsence,
  );
  return router;
}
