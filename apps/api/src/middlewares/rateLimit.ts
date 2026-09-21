import { rateLimit } from 'express-rate-limit';
import { AppError } from '../shared/errors.js';

/** 5 tentativas de login malsucedidas a cada 15 minutos por IP. */
export function loginRateLimit() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) => {
      next(
        new AppError(
          429,
          'TOO_MANY_ATTEMPTS',
          'Muitas tentativas de login. Aguarde alguns minutos e tente novamente.',
        ),
      );
    },
  });
}
