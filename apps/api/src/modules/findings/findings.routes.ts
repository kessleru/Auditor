import { Router } from 'express';
import { publicRateLimit, SCREENSHOT_LIMIT } from '../../middlewares/rateLimit.js';
import type { createFindingsController } from './findings.controller.js';

/** Foto do achado: pública para achado confirmado, livre para o auditor (ADR 0014). */
export function createFindingsRoutes(c: ReturnType<typeof createFindingsController>) {
  const router = Router();
  router.get('/findings/:id/screenshot', publicRateLimit(SCREENSHOT_LIMIT), c.screenshot);
  return router;
}
