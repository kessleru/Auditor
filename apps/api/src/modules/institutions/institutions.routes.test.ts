import { institutionListResponseSchema, institutionResponseSchema } from '@auditoria-rf/contracts';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { loggedInAgent } from '../../test/auth.js';
import { createTestDatabase } from '../../test/db.js';

const iftm = {
  name: 'Instituto Federal do Triângulo Mineiro',
  acronym: 'iftm',
  domain: 'https://IFTM.edu.br/',
};

let app: ReturnType<typeof createApp>;
let agent: Awaited<ReturnType<typeof loggedInAgent>>;

beforeEach(async () => {
  const db = createTestDatabase();
  app = createApp({ db });
  agent = await loggedInAgent(app, db);
});

describe('/api/v1/institutions', () => {
  it('exige sessão', async () => {
    expect((await request(app).get('/api/v1/institutions')).status).toBe(401);
    expect((await request(app).post('/api/v1/institutions').send(iftm)).status).toBe(401);
  });

  it('cria com sigla e domínio normalizados, lista e detalha', async () => {
    const created = await agent.post('/api/v1/institutions').send(iftm);
    expect(created.status).toBe(201);
    const { institution } = institutionResponseSchema.parse(created.body);
    expect(institution).toMatchObject({ acronym: 'IFTM', domain: 'iftm.edu.br', active: true });

    const list = institutionListResponseSchema.parse(
      (await agent.get('/api/v1/institutions')).body,
    );
    expect(list.institutions.map((i) => i.acronym)).toEqual(['IFTM']);

    const detail = await agent.get(`/api/v1/institutions/${institution.id}`);
    expect(detail.body.institution).toEqual(institution);
  });

  it('recusa domínio repetido e domínio de homologação', async () => {
    await agent.post('/api/v1/institutions').send(iftm);
    const dup = await agent.post('/api/v1/institutions').send({ ...iftm, acronym: 'OUTRO' });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('DOMAIN_TAKEN');

    const hml = await agent
      .post('/api/v1/institutions')
      .send({ ...iftm, domain: 'hml.iftm.edu.br' });
    expect(hml.status).toBe(400);
    expect(hml.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('altera campos e desativa', async () => {
    const { body } = await agent.post('/api/v1/institutions').send(iftm);
    const res = await agent
      .patch(`/api/v1/institutions/${body.institution.id}`)
      .send({ active: false });
    expect(res.status).toBe(200);
    expect(res.body.institution.active).toBe(false);
    expect(res.body.institution.name).toBe(iftm.name);
  });

  it('recusa alteração para domínio de outra instituição e corpo vazio', async () => {
    await agent.post('/api/v1/institutions').send(iftm);
    const { body } = await agent
      .post('/api/v1/institutions')
      .send({ name: 'Instituto Federal Goiano', acronym: 'IFGOIANO', domain: 'ifgoiano.edu.br' });
    const id = body.institution.id;

    expect(
      (await agent.patch(`/api/v1/institutions/${id}`).send({ domain: 'iftm.edu.br' })).status,
    ).toBe(409);
    expect((await agent.patch(`/api/v1/institutions/${id}`).send({})).status).toBe(400);
  });

  it('responde 404 para instituição inexistente ou id inválido', async () => {
    expect((await agent.get('/api/v1/institutions/999')).status).toBe(404);
    expect((await agent.get('/api/v1/institutions/abc')).status).toBe(404);
    expect((await agent.patch('/api/v1/institutions/999').send({ active: false })).status).toBe(
      404,
    );
  });
});
