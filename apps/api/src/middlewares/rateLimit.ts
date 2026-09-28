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

/**
 * Limite da API pública (sem sessão) por IP: generoso para a navegação normal (cada tela faz
 * algumas requisições e cada problema carrega uma foto), apertado nos CSVs, que recalculam todas
 * as instituições a cada pedido. Atrás do nginx, o IP vem do X-Forwarded-For (TRUST_PROXY).
 */
export function publicRateLimit({ limit, windowMs }: { limit: number; windowMs: number }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) => {
      next(
        new AppError(
          429,
          'TOO_MANY_REQUESTS',
          'Muitas requisições em pouco tempo. Aguarde alguns minutos e tente novamente.',
        ),
      );
    },
  });
}

/** Navegação pública: 600 requisições a cada 10 minutos por IP. */
export const PUBLIC_LIMIT = { limit: 600, windowMs: 10 * 60 * 1000 };
/** Fotos dos achados: cada problema na tela carrega uma; 3.000 a cada 10 minutos por IP. */
export const SCREENSHOT_LIMIT = { limit: 3000, windowMs: 10 * 60 * 1000 };
/** Exportação em CSV: 20 a cada 10 minutos por IP. */
export const CSV_LIMIT = { limit: 20, windowMs: 10 * 60 * 1000 };
