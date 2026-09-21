import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppError } from '../shared/errors.js';
import { errorHandler } from './errorHandler.js';

function appThrowing(err: unknown) {
  const app = express();
  app.get('/', async () => {
    throw err;
  });
  app.use(errorHandler);
  return app;
}

describe('errorHandler', () => {
  it('usa status, código e detalhes de AppError', async () => {
    const res = await request(
      appThrowing(new AppError(409, 'CONFLICT', 'Já existe.', { id: 1 })),
    ).get('/');
    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: { code: 'CONFLICT', message: 'Já existe.', details: { id: 1 } },
    });
  });

  it('converte ZodError em 400 com os campos inválidos', async () => {
    const parsed = z.object({ email: z.email() }).safeParse({ email: 'x' });
    const res = await request(appThrowing(parsed.error)).get('/');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details[0].path).toBe('email');
  });

  it('esconde a mensagem de erros inesperados', async () => {
    const res = await request(appThrowing(new Error('segredo interno'))).get('/');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor.' },
    });
  });
});
