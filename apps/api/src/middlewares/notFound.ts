import type { RequestHandler } from 'express';
import { NotFoundError } from '../shared/errors.js';

export const notFound: RequestHandler = (req) => {
  throw new NotFoundError(`Rota ${req.method} ${req.path} não encontrada.`);
};
