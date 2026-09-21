import type { RequestHandler } from 'express';
import type { AuthService } from '../modules/auth/auth.service.js';
import { readSessionToken } from '../modules/auth/session-cookie.js';
import { AppError } from '../shared/errors.js';

export function requireAuditor(authService: AuthService): RequestHandler {
  return (req, _res, next) => {
    const auditor = authService.authenticate(readSessionToken(req));
    if (!auditor) throw new AppError(401, 'UNAUTHENTICATED', 'Faça login para continuar.');
    req.auditor = auditor;
    next();
  };
}
