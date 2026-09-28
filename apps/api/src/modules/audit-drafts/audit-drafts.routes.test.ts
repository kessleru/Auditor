import {
  auditDraftResponseSchema,
  collectionResponseSchema,
  discoveryListResponseSchema,
} from '@auditoria-rf/contracts';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import type { DB } from '../../db/client.js';
import { collections } from '../../db/schema.js';
import { seed } from '../../db/seeds/seed.js';
import type { DiscoveryResult } from '../../infra/crawler/index.js';
import { createAuthRepository } from '../../modules/auth/auth.repository.js';
import { createAuthService } from '../../modules/auth/auth.service.js';
import { loggedInAgent } from '../../test/auth.js';
import {
  fakeAuditor,
  okOutcome,
  seedInstitutionWithRoutes,
  tempDir,
} from '../../test/collections.js';
import { createTestDatabase } from '../../test/db.js';

let db: DB;
let snapshots: ReturnType<typeof tempDir>;
/** Domínios que a descoberta falsa recebeu (nenhuma rede nos testes). */
let discovered: string[];

beforeEach(() => {
  db = createTestDatabase();
  seed(db); // funções de página + IFTM (id 1), sem nenhuma rota
  snapshots = tempDir();
  discovered = [];
});

afterEach(() => snapshots.cleanup());

const emptyResult = (domain: string): DiscoveryResult => ({
  origin: `https://${domain}`,
  source: 'crawler',
  robotsTxtFound: false,
  sitemapFiles: [],
  routes: [],
  blockedByRobots: 0,
  failed: 0,
  stoppedEarly: null,
  offDomainHost: null,
  checks: [],
});

function setup() {
  const app = createApp({
    db,
    snapshotsDir: snapshots.dir,
    auditor: fakeAuditor(async () => okOutcome()),
    discover: async (domain) => {
      discovered.push(domain);
      return emptyResult(domain);
    },
  });
  return app;
}

const draftOf = (body: unknown) => auditDraftResponseSchema.parse(body).draft;

describe('auditoria em montagem (ADR 0017)', () => {
  it('exige sessão', async () => {
    const app = setup();
    expect((await request(app).get('/api/v1/audit-draft')).status).toBe(401);
    expect((await request(app).put('/api/v1/audit-draft').send({})).status).toBe(401);
  });

  it('guarda o escopo pela metade e a etapa, e continua lá depois de reiniciar a API', async () => {
    const agent = await loggedInAgent(setup(), db);
    expect(draftOf((await agent.get('/api/v1/audit-draft')).body)).toBeNull();

    // Na etapa do escopo o formulário pode estar incompleto.
    const partial = await agent
      .put('/api/v1/audit-draft')
      .send({ step: 'scope', institutionIds: [], functions: ['admission', 'home'] });
    expect(partial.status).toBe(200);
    expect(draftOf(partial.body)).toMatchObject({
      step: 'scope',
      institutionId: null,
      // As funções ficam na ordem do comparativo, sem repetição.
      scope: { institutionIds: [], functions: ['home', 'admission'] },
    });
    // Para seguir à revisão de rotas, o escopo precisa estar completo.
    const incomplete = await agent
      .put('/api/v1/audit-draft')
      .send({ step: 'routes', institutionIds: [], functions: ['home'] });
    expect(incomplete.status).toBe(400);

    const restarted = await loggedInAgent(setup(), db);
    expect(draftOf((await restarted.get('/api/v1/audit-draft')).body)).toMatchObject({
      step: 'scope',
      scope: { functions: ['home', 'admission'] },
    });
  });

  it('confirmar o escopo põe na fila só a descoberta das instituições ainda não olhadas', async () => {
    const app = setup();
    const agent = await loggedInAgent(app, db);
    const reviewed = seedInstitutionWithRoutes(db, {
      domain: 'if-a.edu.br',
      acronym: 'IFA',
      urls: [{ url: 'https://if-a.edu.br', functionKey: 'home' }],
    });

    const res = await agent
      .put('/api/v1/audit-draft')
      .send({ step: 'routes', institutionIds: [1, reviewed.institution.id], functions: ['home'] });
    expect(draftOf(res.body)).toMatchObject({ step: 'routes', institutionId: null });
    await app.services.discovery.idle();

    // O IFTM não tinha rota nem descoberta: entrou na fila. O IFA já tinha rota confirmada.
    expect(discovered).toEqual(['iftm.edu.br']);
    const list = discoveryListResponseSchema.parse(
      (await agent.get(`/api/v1/discoveries?institutionIds=1,${reviewed.institution.id}`)).body,
    );
    expect(list.discoveries.map((d) => d.status)).toEqual(['completed', 'idle']);

    // Voltar ao escopo e confirmar de novo não repete a descoberta já feita.
    await agent
      .put('/api/v1/audit-draft')
      .send({ step: 'routes', institutionIds: [1, reviewed.institution.id], functions: ['home'] });
    await app.services.discovery.idle();
    expect(discovered).toEqual(['iftm.edu.br']);
  });

  it('lembra a instituição em revisão; recusa instituição fora do escopo', async () => {
    const agent = await loggedInAgent(setup(), db);
    expect(
      (await agent.patch('/api/v1/audit-draft/position').send({ step: 'routes', institutionId: 1 }))
        .status,
    ).toBe(404);

    await agent
      .put('/api/v1/audit-draft')
      .send({ step: 'routes', institutionIds: [1], functions: ['home'] });
    const moved = await agent
      .patch('/api/v1/audit-draft/position')
      .send({ step: 'routes', institutionId: 1 });
    expect(draftOf(moved.body)).toMatchObject({ step: 'routes', institutionId: 1 });

    const outside = await agent
      .patch('/api/v1/audit-draft/position')
      .send({ step: 'routes', institutionId: 999 });
    expect(outside.status).toBe(422);
    expect(outside.body.error.code).toBe('NOT_IN_SCOPE');

    // Voltar ao escopo também fica salvo.
    const back = await agent
      .patch('/api/v1/audit-draft/position')
      .send({ step: 'scope', institutionId: null });
    expect(draftOf(back.body)).toMatchObject({ step: 'scope', institutionId: null });
  });

  it('um rascunho por auditor; descartar apaga só o dele', async () => {
    const app = setup();
    const agent = await loggedInAgent(app, db);
    await createAuthService(createAuthRepository(db)).createAuditor({
      email: 'outra@iftm.edu.br',
      name: 'Outra',
      password: 'outra-senha',
    });
    const other = request.agent(app);
    await other
      .post('/api/v1/auth/login')
      .send({ email: 'outra@iftm.edu.br', password: 'outra-senha' });

    await agent
      .put('/api/v1/audit-draft')
      .send({ step: 'scope', institutionIds: [1], functions: ['home'] });
    expect(draftOf((await other.get('/api/v1/audit-draft')).body)).toBeNull();
    await other
      .put('/api/v1/audit-draft')
      .send({ step: 'scope', institutionIds: [1], functions: ['library'] });

    expect((await agent.delete('/api/v1/audit-draft')).status).toBe(204);
    expect(draftOf((await agent.get('/api/v1/audit-draft')).body)).toBeNull();
    expect(draftOf((await other.get('/api/v1/audit-draft')).body)?.scope.functions).toEqual([
      'library',
    ]);
  });

  it('iniciar a coleta usa o escopo salvo e só então apaga o rascunho', async () => {
    const app = setup();
    const agent = await loggedInAgent(app, db);
    const { institution } = seedInstitutionWithRoutes(db, {
      domain: 'if-a.edu.br',
      acronym: 'IFA',
      urls: [{ url: 'https://if-a.edu.br', functionKey: 'home' }],
    });
    expect((await agent.post('/api/v1/audit-draft/start')).status).toBe(404);

    // O IFTM ainda não tem a página inicial revisada: a coleta é recusada e o rascunho fica.
    await agent
      .put('/api/v1/audit-draft')
      .send({ step: 'routes', institutionIds: [1, institution.id], functions: ['home'] });
    const refused = await agent.post('/api/v1/audit-draft/start');
    expect(refused.body.error.code).toBe('FUNCTIONS_NOT_REVIEWED');
    expect(draftOf((await agent.get('/api/v1/audit-draft')).body)).not.toBeNull();

    await agent
      .put('/api/v1/audit-draft')
      .send({ step: 'routes', institutionIds: [institution.id], functions: ['home'] });
    const started = await agent.post('/api/v1/audit-draft/start');
    expect(started.status).toBe(201);
    const { collection } = collectionResponseSchema.parse(started.body);
    expect(collection.scope).toEqual({ institutionIds: [institution.id], functions: ['home'] });
    expect(db.select().from(collections).all()).toHaveLength(1);
    expect(draftOf((await agent.get('/api/v1/audit-draft')).body)).toBeNull();
    await app.services.collections.waitForFinish(collection.id);
  });
});
