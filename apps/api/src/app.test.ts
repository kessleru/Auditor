import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { apiErrorSchema, healthResponseSchema } from '@auditoria-rf/contracts';
import { createApp } from './app.js';
import { createTestDatabase } from './test/db.js';

const webOrigin = 'http://localhost:5173';
const app = createApp({ db: createTestDatabase(), webOrigin });

describe('GET /api/v1/health', () => {
  it('responde com o contrato de health', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(healthResponseSchema.safeParse(res.body).success).toBe(true);
  });

  it('aplica os cabeçalhos de segurança do Helmet', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('CORS', () => {
  it('libera a origem do front', async () => {
    const res = await request(app).get('/api/v1/health').set('Origin', webOrigin);
    expect(res.headers['access-control-allow-origin']).toBe(webOrigin);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('não libera outras origens', async () => {
    const res = await request(app).get('/api/v1/health').set('Origin', 'https://outro.site');
    expect(res.headers['access-control-allow-origin']).not.toBe('https://outro.site');
  });
});

describe('erros', () => {
  it('responde 404 no formato padrão para rota inexistente', async () => {
    const res = await request(app).get('/api/v1/nao-existe');
    expect(res.status).toBe(404);
    expect(apiErrorSchema.safeParse(res.body).success).toBe(true);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('responde 400 para JSON malformado', async () => {
    const res = await request(app)
      .post('/api/v1/health')
      .set('Content-Type', 'application/json')
      .send('{"a":');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });
});
