import type { ErrorRequestHandler } from 'express';
import type { ApiError } from '@auditoria-rf/contracts';
import { ZodError } from 'zod';
import { AppError } from '../shared/errors.js';
import { logger } from '../shared/logger.js';

function isBodyParserError(err: unknown): err is { status: number; type: string } {
  return typeof err === 'object' && err !== null && 'type' in err && 'status' in err;
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  let status = 500;
  let body: ApiError = { error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor.' } };

  if (err instanceof AppError) {
    status = err.status;
    body = { error: { code: err.code, message: err.message, details: err.details } };
  } else if (err instanceof ZodError) {
    status = 400;
    body = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Dados de entrada inválidos.',
        details: err.issues.map(({ path, message }) => ({ path: path.join('.'), message })),
      },
    };
  } else if (isBodyParserError(err) && err.type === 'entity.parse.failed') {
    status = 400;
    body = {
      error: { code: 'INVALID_JSON', message: 'Corpo da requisição não é um JSON válido.' },
    };
  } else if (isBodyParserError(err) && err.type === 'entity.too.large') {
    status = 413;
    body = { error: { code: 'PAYLOAD_TOO_LARGE', message: 'Corpo da requisição grande demais.' } };
  } else {
    logger.error({ err }, 'erro não tratado');
  }

  res.status(status).json(body);
};
