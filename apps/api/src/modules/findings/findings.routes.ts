import { Router } from 'express';
import type { createFindingsController } from './findings.controller.js';

/** Foto do achado: pública para achado confirmado, livre para o auditor (ADR 0014). */
export function createFindingsRoutes(c: ReturnType<typeof createFindingsController>) {
  const router = Router();
  router.get('/findings/:id/screenshot', c.screenshot);
  return router;
}
