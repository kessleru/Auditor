import { existsSync, readFileSync } from 'node:fs';
import { request as httpRequest } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import {
  type CollectionEvent,
  collectionDetailResponseSchema,
  collectionResponseSchema,
} from '@auditoria-rf/contracts';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import type { DB } from '../../db/client.js';
import { collectionPages, collections, findings, users } from '../../db/schema.js';
import { seed } from '../../db/seeds/seed.js';
import type { AuditOutcome, PageAuditor } from '../../infra/auditor/page-auditor.js';
import { createServices } from '../../services.js';
import { loggedInAgent, testAuditor } from '../../test/auth.js';
import {
  deferred,
  fakeAuditor,
  okOutcome,
  seedInstitutionWithRoutes,
  setRouteStatus,
  tempDir,
} from '../../test/collections.js';
import { createTestDatabase } from '../../test/db.js';

let db: DB;
let snapshots: ReturnType<typeof tempDir>;

beforeEach(() => {
  db = createTestDatabase();
  seed(db);
  snapshots = tempDir();
});

afterEach(() => snapshots.cleanup());

function institutionA() {
  return seedInstitutionWithRoutes(db, {
    domain: 'if-a.edu.br',
    acronym: 'IFA',
    urls: [
      { url: 'https://www.if-a.edu.br', functionKey: 'home' },
      { url: 'https://www.if-a.edu.br/ingresso', functionKey: 'admission' },
      { url: 'https://www.if-a.edu.br/biblioteca', functionKey: 'library' },
    ],
  });
}

async function setup(auditor: PageAuditor | null, concurrency = 2) {
  const app = createApp({ db, auditor, discover: null, snapshotsDir: snapshots.dir, concurrency });
  const agent = await loggedInAgent(app, db);
  return { app, agent, service: app.services.collections };
}

const create = (agent: Awaited<ReturnType<typeof setup>>['agent'], body: object) =>
  agent.post('/api/v1/collections').send(body);

describe('POST /api/v1/collections', () => {
  it('exige sessão e valida a entrada', async () => {
    const { app, agent } = await setup(fakeAuditor(async () => okOutcome()));
    expect(
      (
        await request(app)
          .post('/api/v1/collections')
          .send({ institutionIds: [1] })
      ).status,
    ).toBe(401);
    expect((await create(agent, { institutionIds: [] })).status).toBe(400);
    expect((await create(agent, { institutionIds: [1], functions: ['inexistente'] })).status).toBe(
      400,
    );
  });

  it('recusa escopo sem rota confirmada, instituição inexistente e motor não configurado', async () => {
    const { agent } = await setup(fakeAuditor(async () => okOutcome()));
    // IFTM (id 1, do seed) não tem nenhuma função revisada.
    const unreviewed = await create(agent, { institutionIds: [1], functions: ['home', 'library'] });
    expect(unreviewed.status).toBe(422);
    expect(unreviewed.body.error).toMatchObject({
      code: 'FUNCTIONS_NOT_REVIEWED',
      message: 'Confirme a rota ou marque como não encontrada: IFTM: Página inicial, Biblioteca.',
      details: { unreviewed: [{ institutionId: 1, functions: ['home', 'library'] }] },
    });
    // Tudo marcado como não encontrado: sem nenhuma página, não há o que coletar.
    for (const key of ['home', 'library']) {
      const marked = await agent
        .put(`/api/v1/institutions/1/functions/${key}/absence`)
        .send({ reason: 'Procurei no menu e no mapa do site.' });
      expect(marked.status).toBe(200);
    }
    const empty = await create(agent, { institutionIds: [1], functions: ['home', 'library'] });
    expect(empty.status).toBe(422);
    expect(empty.body.error.code).toBe('INSTITUTION_WITHOUT_ROUTES');
    expect((await create(agent, { institutionIds: [999] })).status).toBe(404);

    const unconfiguredApp = createApp({
      db,
      auditor: null,
      discover: null,
      snapshotsDir: snapshots.dir,
    });
    const other = request.agent(unconfiguredApp);
    await other
      .post('/api/v1/auth/login')
      .send({ email: testAuditor.email, password: testAuditor.password });
    const unconfigured = await other
      .post('/api/v1/collections')
      .send({ institutionIds: [institutionA().institution.id] });
    expect(unconfigured.status).toBe(503);
  });

  it('só inclui rotas confirmadas, filtrando por função', async () => {
    const { agent, service } = await setup(fakeAuditor(async () => okOutcome()));
    const { institution, routes } = institutionA();
    setRouteStatus(db, routes[2]!.id, 'suggested');

    // Biblioteca voltou a ser sugestão: ainda não foi revisada, então não pode entrar.
    const pending = await create(agent, {
      institutionIds: [institution.id],
      functions: ['home', 'library'],
    });
    expect(pending.body.error.code).toBe('FUNCTIONS_NOT_REVIEWED');

    const res = await create(agent, {
      institutionIds: [institution.id],
      functions: ['home', 'admission', 'courses'],
    });
    expect(res.status).toBe(201);
    const { collection } = collectionResponseSchema.parse(res.body);
    expect(collection.scope).toEqual({
      institutionIds: [institution.id],
      functions: ['home', 'admission', 'courses'],
    });
    // Cursos está marcada como não encontrada: entra na cobertura, não vira página.
    expect(collection.progress.total).toBe(2);
    await service.waitForFinish(collection.id);
  });
});

describe('execução da coleta', () => {
  it('audita as páginas, grava contagens, achados, snapshots e versões', async () => {
    const auditor = fakeAuditor(async (url) =>
      okOutcome(
        url.endsWith('/ingresso')
          ? [{ rule: 'image-alt', targets: ['img.logo', 'img.banner'] }]
          : [],
        url.endsWith('/ingresso')
          ? [{ ruleId: 'image-alt', selector: 'img.logo', image: Buffer.from('jpeg') }]
          : [],
      ),
    );
    const { agent, service } = await setup(auditor);
    const { institution } = institutionA();

    const { body } = await create(agent, { institutionIds: [institution.id] });
    const finished = await service.waitForFinish(body.collection.id);
    // O motor confere se a página terminou no domínio da instituição (ADR 0016).
    expect(auditor.domains).toEqual(['if-a.edu.br', 'if-a.edu.br', 'if-a.edu.br']);
    expect(finished).toMatchObject({
      status: 'completed',
      axeVersion: '4.13.0',
      browserVersion: 'Chromium teste',
      userAgent: 'AuditoriaRF/1.0 (+teste)',
    });
    expect(finished.startedAt).toBeInstanceOf(Date);
    expect(finished.finishedAt).toBeInstanceOf(Date);

    const detail = collectionDetailResponseSchema.parse(
      (await agent.get(`/api/v1/collections/${body.collection.id}`)).body,
    );
    expect(detail.collection.progress).toEqual({
      total: 3,
      queued: 0,
      running: 0,
      done: 3,
      failed: 0,
    });
    const ingresso = detail.pages.find((p) => p.url.endsWith('/ingresso'));
    expect(ingresso).toMatchObject({
      status: 'done',
      httpStatus: 200,
      functionKey: 'admission',
      passesCount: 2,
      violationsCount: 1,
      incompleteCount: 1,
      inapplicableCount: 1,
      loadTimeMs: 1234,
      failureKind: null,
    });

    const rows = db
      .select()
      .from(findings)
      .where(eq(findings.collectionPageId, ingresso!.id))
      .all();
    expect(rows.map((f) => f.selector).sort()).toEqual(['img.banner', 'img.logo']);
    expect(rows[0]).toMatchObject({
      ruleId: 'image-alt',
      wcagCriteria: '1.1.1',
      severity: 'critical',
      validation: 'pending',
    });
    // A foto do elemento fica ao lado do snapshot; sem foto, o achado fica sem caminho.
    const logo = rows.find((f) => f.selector === 'img.logo');
    expect(logo?.screenshotPath).toBe(`${body.collection.id}/${ingresso!.id}/${logo!.id}.jpg`);
    expect(readFileSync(join(snapshots.dir, logo!.screenshotPath!)).toString()).toBe('jpeg');
    expect(rows.find((f) => f.selector === 'img.banner')?.screenshotPath).toBeNull();

    const page = db
      .select()
      .from(collectionPages)
      .where(eq(collectionPages.id, ingresso!.id))
      .get();
    expect(page?.snapshotPath).toBe(`${body.collection.id}/${ingresso!.id}.html.gz`);
    expect(existsSync(join(snapshots.dir, page!.snapshotPath!))).toBe(true);
    expect(
      existsSync(join(snapshots.dir, `${body.collection.id}/${ingresso!.id}.axe.json.gz`)),
    ).toBe(true);
  });

  it('falha de uma página vira failed sem derrubar a coleta (parcial)', async () => {
    const auditor = fakeAuditor(async (url) => {
      if (url.endsWith('/ingresso'))
        return { ok: false, httpStatus: null, error: 'net::ERR_CONNECTION_RESET' };
      if (url.endsWith('/biblioteca')) throw new Error('navegador caiu');
      return okOutcome();
    });
    const { agent, service } = await setup(auditor);
    const { body } = await create(agent, { institutionIds: [institutionA().institution.id] });

    expect((await service.waitForFinish(body.collection.id)).status).toBe('partial');
    const { pages } = service.get(body.collection.id);
    expect(pages.map((p) => [p.url.split('/').pop(), p.status, p.error])).toEqual([
      ['www.if-a.edu.br', 'done', null],
      ['ingresso', 'failed', 'net::ERR_CONNECTION_RESET'],
      ['biblioteca', 'failed', 'Erro interno: navegador caiu'],
    ]);
    // Motivo agrupado, para o relatório de confiabilidade da coleta.
    const detail = collectionDetailResponseSchema.parse(
      (await agent.get(`/api/v1/collections/${body.collection.id}`)).body,
    );
    expect(detail.pages.map((p) => p.failureKind)).toEqual([null, 'network', 'tool']);
  });

  it('nunca audita duas páginas do mesmo host ao mesmo tempo', async () => {
    let running = 0;
    let peak = 0;
    const auditor = fakeAuditor(async () => {
      peak = Math.max(peak, ++running);
      await new Promise((r) => setTimeout(r, 5));
      running--;
      return okOutcome();
    });
    const { agent, service } = await setup(auditor, 4);
    const { body } = await create(agent, { institutionIds: [institutionA().institution.id] });
    await service.waitForFinish(body.collection.id);
    expect(peak).toBe(1);
  });

  it('instituições de domínios diferentes rodam em paralelo', async () => {
    const gates = [deferred<void>(), deferred<void>()];
    let running = 0;
    let peak = 0;
    const auditor = fakeAuditor(async (url) => {
      peak = Math.max(peak, ++running);
      await gates[url.includes('if-a') ? 0 : 1]!.promise;
      running--;
      return okOutcome();
    });
    const { agent, service } = await setup(auditor, 2);
    const a = seedInstitutionWithRoutes(db, {
      domain: 'if-a.edu.br',
      acronym: 'IFA',
      urls: [{ url: 'https://www.if-a.edu.br', functionKey: 'home' }],
    });
    const b = seedInstitutionWithRoutes(db, {
      domain: 'if-b.edu.br',
      acronym: 'IFB',
      urls: [{ url: 'https://www.if-b.edu.br', functionKey: 'home' }],
    });

    const { body } = await create(agent, { institutionIds: [a.institution.id, b.institution.id] });
    await new Promise((r) => setTimeout(r, 20));
    expect(peak).toBe(2);
    gates.forEach((g) => g.resolve());
    expect((await service.waitForFinish(body.collection.id)).status).toBe('completed');
  });
});

describe('trava por domínio', () => {
  it('uma segunda coleta no mesmo domínio aguarda a primeira terminar', async () => {
    const gate = deferred<void>();
    const auditor = fakeAuditor(async () => {
      await gate.promise;
      return okOutcome();
    });
    const { agent, service } = await setup(auditor);
    const { institution } = institutionA();

    const first = (await create(agent, { institutionIds: [institution.id], functions: ['home'] }))
      .body.collection;
    const second = (
      await create(agent, { institutionIds: [institution.id], functions: ['library'] })
    ).body.collection;
    await new Promise((r) => setTimeout(r, 20));

    expect(service.getWithProgress(first.id).collection.status).toBe('running');
    expect(service.getWithProgress(second.id).collection.status).toBe('queued');
    expect(auditor.audited).toEqual(['https://www.if-a.edu.br']);

    gate.resolve();
    await service.waitForFinish(first.id);
    const done = await service.waitForFinish(second.id);
    expect(done.status).toBe('completed');
    expect(done.startedAt!.getTime()).toBeGreaterThanOrEqual(
      service.getWithProgress(first.id).collection.finishedAt!.getTime(),
    );
    expect(auditor.audited).toEqual([
      'https://www.if-a.edu.br',
      'https://www.if-a.edu.br/biblioteca',
    ]);
  });

  it('respeita coleta em execução registrada por outro processo', async () => {
    const auditor = fakeAuditor(async () => okOutcome());
    const { agent, service } = await setup(auditor);
    const { institution } = institutionA();
    // Outro processo (ex.: a CLI) marcou uma coleta deste domínio como em execução.
    const foreign = db
      .insert(collections)
      .values({
        status: 'running',
        scopeJson: { institutionIds: [institution.id], functions: null },
        createdBy: 1,
      })
      .returning()
      .get();

    const mine = (await create(agent, { institutionIds: [institution.id] })).body.collection;
    await new Promise((r) => setTimeout(r, 20));
    expect(service.getWithProgress(mine.id).collection.status).toBe('queued');
    expect(auditor.audited).toEqual([]);

    db.update(collections).set({ status: 'completed' }).where(eq(collections.id, foreign.id)).run();
    service.resume();
    expect((await service.waitForFinish(mine.id)).status).toBe('completed');
  });
});

describe('teste-reteste', () => {
  it('audita as rotas confirmadas várias vezes e mede a concordância, sem gravar nada', async () => {
    let ingresso = 0;
    // O banner do ingresso é um carrossel: a imagem sem alt só aparece na primeira rodada.
    const auditor = fakeAuditor(async (url) =>
      url.endsWith('/ingresso') && ingresso++ === 0
        ? okOutcome([{ rule: 'image-alt', targets: ['.slide-1 img'] }])
        : okOutcome(),
    );
    const { service } = await setup(auditor);
    const { institution } = institutionA();

    const result = await service.retest(institution.id, 2);
    expect(auditor.audited).toHaveLength(6);
    expect(auditor.domains.every((d) => d === 'if-a.edu.br')).toBe(true);
    expect(result.summary).toEqual({
      pages: 3,
      compared: 3,
      stable: 2,
      meanRuleAgreement: 2 / 3,
      meanFindingAgreement: 2 / 3,
    });
    const page = result.pages.find((p) => p.url.endsWith('/ingresso'));
    expect(page).toMatchObject({
      functionKey: 'admission',
      stable: false,
      unstableRules: ['image-alt'],
    });
    // Nada vai para o banco: nem coleta nem achado.
    expect(db.select().from(collections).all()).toEqual([]);
    expect(db.select().from(findings).all()).toEqual([]);
  });

  it('não roda com uma coleta em execução no mesmo domínio', async () => {
    const gate = deferred<AuditOutcome>();
    const auditor = fakeAuditor(() => gate.promise);
    const { agent, service } = await setup(auditor);
    const { institution } = institutionA();
    await create(agent, { institutionIds: [institution.id] });
    await new Promise((r) => setTimeout(r, 20));

    await expect(service.retest(institution.id)).rejects.toMatchObject({
      status: 409,
      code: 'DOMAIN_BUSY',
    });
    gate.resolve(okOutcome());
    await service.idle();
  });
});

describe('cancelamento, nova tentativa e retomada', () => {
  it('cancela: a página em execução termina e nenhuma outra começa', async () => {
    const gate = deferred<void>();
    const auditor = fakeAuditor(async () => {
      await gate.promise;
      return okOutcome();
    });
    const { agent, service } = await setup(auditor);
    const { body } = await create(agent, { institutionIds: [institutionA().institution.id] });
    await new Promise((r) => setTimeout(r, 20));

    const res = await agent.post(`/api/v1/collections/${body.collection.id}/cancel`);
    expect(res.status).toBe(200);
    expect(res.body.collection.status).toBe('cancelled');
    gate.resolve();
    await service.idle();

    expect(auditor.audited).toHaveLength(1);
    expect(service.get(body.collection.id).progress).toMatchObject({
      done: 1,
      queued: 2,
      running: 0,
    });
    expect((await agent.post(`/api/v1/collections/${body.collection.id}/cancel`)).status).toBe(409);
  });

  it('tenta de novo uma página que falhou e reabre a coleta', async () => {
    let fail = true;
    const auditor = fakeAuditor(async (url) =>
      fail && url.endsWith('/ingresso')
        ? { ok: false, httpStatus: 503, error: 'HTTP 503' }
        : okOutcome(),
    );
    const { agent, service } = await setup(auditor);
    const { body } = await create(agent, { institutionIds: [institutionA().institution.id] });
    expect((await service.waitForFinish(body.collection.id)).status).toBe('partial');

    const failed = service.get(body.collection.id).pages.find((p) => p.status === 'failed')!;
    const done = service.get(body.collection.id).pages.find((p) => p.status === 'done')!;
    expect((await agent.post(`/api/v1/collection-pages/${done.id}/retry`)).status).toBe(409);

    fail = false;
    const retry = await agent.post(`/api/v1/collection-pages/${failed.id}/retry`);
    expect(retry.status).toBe(200);
    expect(retry.body.page).toMatchObject({ status: 'queued', error: null });
    expect((await service.waitForFinish(body.collection.id)).status).toBe('completed');
  });

  it('navegador que não abre encerra a coleta com o motivo, sem derrubar o servidor', async () => {
    let broken = true;
    const auditor = {
      ...fakeAuditor(async () => okOutcome()),
      versions: async () => {
        if (broken) throw new Error("browserType.launch: Executable doesn't exist at /x");
        return { axeVersion: '4.13.0', browserVersion: 'Chromium teste', userAgent: 'UA' };
      },
    };
    const { agent, service } = await setup(auditor);
    const { body } = await create(agent, { institutionIds: [institutionA().institution.id] });
    expect((await service.waitForFinish(body.collection.id)).status).toBe('partial');
    const pages = service.get(body.collection.id).pages;
    expect(pages.every((p) => p.status === 'failed')).toBe(true);
    expect(pages[0]!.error).toBe(
      'Não foi possível iniciar o navegador: O navegador do Playwright não abriu. Instale com: npx playwright install chromium.',
    );

    // Corrigido o navegador, "tentar de novo" reabre a coleta, que agora registra as versões.
    broken = false;
    await agent.post(`/api/v1/collection-pages/${pages[0]!.id}/retry`);
    const finished = await service.waitForFinish(body.collection.id);
    expect(finished.axeVersion).toBe('4.13.0');
    // A trava do domínio foi liberada: uma nova coleta no mesmo portal começa normalmente.
    const again = await create(agent, { institutionIds: [pages[0]!.institutionId] });
    expect((await service.waitForFinish(again.body.collection.id)).status).toBe('completed');
  });

  it('retoma após reinício: o que estava em execução volta para a fila', async () => {
    await createServices(db, { auditor: null, discover: null }).auth.createAuditor(testAuditor);
    const { institution, routes } = institutionA();
    // Estado deixado por um servidor que caiu no meio da coleta.
    const collection = db
      .insert(collections)
      .values({
        status: 'running',
        scopeJson: { institutionIds: [institution.id], functions: null },
        createdBy: 1,
        axeVersion: '4.13.0',
        browserVersion: 'Chromium anterior',
        userAgent: 'UA',
        startedAt: new Date('2026-09-01T10:00:00Z'),
      })
      .returning()
      .get();
    db.insert(collectionPages)
      .values([
        {
          collectionId: collection.id,
          routeId: routes[0]!.id,
          status: 'done',
          passesCount: 5,
          evaluatedAt: new Date(),
        },
        { collectionId: collection.id, routeId: routes[1]!.id, status: 'running' },
        { collectionId: collection.id, routeId: routes[2]!.id, status: 'queued' },
      ])
      .run();

    const auditor = fakeAuditor(async () => okOutcome());
    const services = createServices(db, { auditor, discover: null, snapshotsDir: snapshots.dir });
    services.collections.resume();
    const finished = await services.collections.waitForFinish(collection.id);

    expect(finished.status).toBe('completed');
    expect(auditor.audited).toEqual([
      'https://www.if-a.edu.br/ingresso',
      'https://www.if-a.edu.br/biblioteca',
    ]);
    // Versões e início da primeira execução são preservados.
    expect(finished.browserVersion).toBe('Chromium anterior');
    expect(finished.startedAt?.toISOString()).toBe('2026-09-01T10:00:00.000Z');
  });
});

describe('GET /api/v1/collections/:id/events (SSE)', () => {
  it('envia o progresso e o heartbeat', async () => {
    const gate = deferred<AuditOutcome>();
    const { app, agent, service } = await setup(
      fakeAuditor(() => gate.promise),
      1,
    );
    const { institution } = seedInstitutionWithRoutes(db, {
      domain: 'if-a.edu.br',
      acronym: 'IFA',
      urls: [{ url: 'https://www.if-a.edu.br', functionKey: 'home' }],
    });
    const cookie = (
      await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testAuditor.email, password: testAuditor.password })
    ).headers['set-cookie'] as unknown as string[];

    // Heartbeat curto só neste app de teste.
    const sseApp = createApp({ db, services: app.services, sseHeartbeatMs: 20 });
    const server = sseApp.listen(0);
    const { port } = server.address() as AddressInfo;

    const { body } = await create(agent, { institutionIds: [institution.id] });
    const received: string[] = [];
    const events: CollectionEvent[] = [];

    await new Promise<void>((resolve, reject) => {
      const req = httpRequest(
        {
          port,
          path: `/api/v1/collections/${body.collection.id}/events`,
          headers: { cookie: cookie.join('; ') },
        },
        (res) => {
          expect(res.statusCode).toBe(200);
          expect(res.headers['content-type']).toMatch(/text\/event-stream/);
          res.setEncoding('utf8');
          res.on('data', (chunk: string) => {
            received.push(chunk);
            for (const block of chunk.split('\n\n')) {
              const data = /^data: (.*)$/m.exec(block)?.[1];
              if (data) events.push(JSON.parse(data) as CollectionEvent);
            }
            if (received.join('').includes(': heartbeat')) gate.resolve(okOutcome());
            if (events.some((e) => e.type === 'collection-finished')) {
              req.destroy();
              resolve();
            }
          });
        },
      );
      req.on('error', (err) => (err.message.includes('socket hang up') ? resolve() : reject(err)));
      req.end();
    });
    server.close();

    expect(received.join('')).toContain(': heartbeat');
    const types = events.map((e) => e.type).filter((t) => t !== 'page-started');
    expect(types).toEqual(['page-done', 'collection-finished']);
    const done = events.find((e) => e.type === 'page-done');
    expect(done?.type === 'page-done' && done.page.status).toBe('done');
    await service.idle();
  });

  it('responde 404 para coleta inexistente', async () => {
    const { agent } = await setup(fakeAuditor(async () => okOutcome()));
    expect((await agent.get('/api/v1/collections/999/events')).status).toBe(404);
    expect((await agent.get('/api/v1/collections/999')).status).toBe(404);
  });
});

describe('GET /api/v1/collections', () => {
  it('lista com progresso e instituições, filtrando por situação', async () => {
    const { agent, service } = await setup(fakeAuditor(async () => okOutcome()));
    const { institution } = institutionA();
    const { body } = await create(agent, { institutionIds: [institution.id] });
    await service.waitForFinish(body.collection.id);

    const all = await agent.get('/api/v1/collections');
    expect(all.status).toBe(200);
    expect(all.body.collections).toHaveLength(1);
    expect(all.body.collections[0]).toMatchObject({
      id: body.collection.id,
      status: 'completed',
      institutions: [{ id: institution.id, acronym: 'IFA', name: 'Instituto IFA' }],
      progress: { total: 3, done: 3 },
    });
    // Quem criou a coleta (a conta de demonstração aparece pelo nome).
    const author = db
      .select()
      .from(users)
      .where(eq(users.id, all.body.collections[0].createdBy))
      .get();
    expect(all.body.collections[0].createdByName).toBe(author?.name);

    const running = await agent.get('/api/v1/collections?status=queued,running');
    expect(running.body.collections).toEqual([]);
    expect((await agent.get('/api/v1/collections?status=qualquer')).status).toBe(400);

    const detail = await agent.get(`/api/v1/collections/${body.collection.id}`);
    expect(detail.body.institutions).toEqual([
      { id: institution.id, acronym: 'IFA', name: 'Instituto IFA' },
    ]);
  });

  it('recusa escopo com instituição sem rota confirmada para as funções', async () => {
    const { agent } = await setup(fakeAuditor(async () => okOutcome()));
    const a = institutionA();
    const b = seedInstitutionWithRoutes(db, {
      domain: 'if-b.edu.br',
      acronym: 'IFB',
      urls: [{ url: 'https://www.if-b.edu.br/biblioteca', functionKey: 'library' }],
    });
    const res = await create(agent, {
      institutionIds: [a.institution.id, b.institution.id],
      functions: ['home'],
    });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatchObject({
      code: 'INSTITUTION_WITHOUT_ROUTES',
      details: { institutionIds: [b.institution.id] },
    });
  });
});
