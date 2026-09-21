import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { healthResponseSchema } from '@auditoria-rf/contracts';
import { createApp } from './app.js';

describe('GET /api/v1/health', () => {
  it('responde com o contrato de health', async () => {
    const res = await request(createApp()).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(healthResponseSchema.safeParse(res.body).success).toBe(true);
  });
});
