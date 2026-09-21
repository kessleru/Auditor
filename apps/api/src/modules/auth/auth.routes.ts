import { type RequestHandler, Router } from 'express';
import { loginRateLimit } from '../../middlewares/rateLimit.js';
import type { createAuthController } from './auth.controller.js';

export function createAuthRoutes(
  controller: ReturnType<typeof createAuthController>,
  requireAuditor: RequestHandler,
) {
  const router = Router();
  router.post('/auth/login', loginRateLimit(), controller.login);
  router.post('/auth/logout', controller.logout);
  router.get('/auth/me', requireAuditor, controller.me);
  return router;
}
