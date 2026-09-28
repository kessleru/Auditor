import { discoveryResponseSchema, routeListResponseSchema } from '@auditoria-rf/contracts';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import type { DB } from '../../db/client.js';
import { seed } from '../../db/seeds/seed.js';
import { fakeSite, html, links } from '../../infra/crawler/__fixtures__/site.js';
import { discoverRoutes, type DiscoveryResult } from '../../infra/crawler/index.js';
import { loggedInAgent } from '../../test/auth.js';
import { createTestDatabase } from '../../test/db.js';
import type { DiscoverFn } from './discovery.service.js';

const ORIGIN = 'https://www.iftm.edu.br';

/** Portal falso do IFTM, sem sitemap, lido pelo crawler real. */
function iftmSite(extraLinks: string[] = []) {
  return fakeSite({
    'https://iftm.edu.br/robots.txt': { redirect: `${ORIGIN}/robots.txt` },
    [`${ORIGIN}/robots.txt`]: { status: 404, body: '' },
    [`${ORIGIN}/`]: {
      body: html(
        'IFTM',
        links(
          ['/ingresso', 'Ingresso'],
          ['/biblioteca', 'Biblioteca'],
          '/noticias',
          '/suap',
          ...extraLinks,
        ),
      ),
    },
    [`${ORIGIN}/ingresso`]: { body: html('Processo seletivo') },
    [`${ORIGIN}/biblioteca`]: { body: html('Biblioteca') },
    [`${ORIGIN}/noticias`]: { body: html('Notícias') },
    [`${ORIGIN}/suap`]: { redirect: 'https://suap.iftm.edu.br/accounts/login/', status: 302 },
    [`${ORIGIN}/nova`]: { body: html('Página nova') },
  });
}

const crawl =
  (site: ReturnType<typeof fakeSite>): DiscoverFn =>
  (domain, checkUrls, onProgress) =>
    discoverRoutes({
      domain,
      client: site.client,
      robotsAgent: 'AuditoriaRF',
      checkUrls,
      onProgress,
    });

let db: DB;
let discover: DiscoverFn;

beforeEach(() => {
  db = createTestDatabase();
  seed(db); // funções de página + IFTM (id 1)
  discover = crawl(iftmSite());
});

async function setup() {
  const app = createApp({
    db,
    discover: (domain, checkUrls, onProgress) => discover(domain, checkUrls, onProgress),
  });
  const agent = await loggedInAgent(app, db);
  return { app, agent };
}

async function waitForDiscovery(agent: Awaited<ReturnType<typeof setup>>['agent'], id = 1) {
  for (let i = 0; i < 100; i++) {
    const { discovery } = discoveryResponseSchema.parse(
      (await agent.get(`/api/v1/institutions/${id}/discovery`)).body,
    );
    if (discovery.status !== 'running') return discovery;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error('A descoberta não terminou.');
}

async function listRoutes(agent: Awaited<ReturnType<typeof setup>>['agent'], query = '') {
  const res = await agent.get(`/api/v1/institutions/1/routes${query}`);
  return routeListResponseSchema.parse(res.body).routes;
}

describe('descoberta de rotas', () => {
  it('exige sessão', async () => {
    const { app } = await setup();
    expect((await request(app).post('/api/v1/institutions/1/discover')).status).toBe(401);
    expect((await request(app).get('/api/v1/institutions/1/routes')).status).toBe(401);
    expect(
      (await request(app).patch('/api/v1/routes/1').send({ status: 'confirmed' })).status,
    ).toBe(401);
  });

  it('roda em segundo plano e grava as rotas como sugestões', async () => {
    const { agent } = await setup();

    const started = await agent.post('/api/v1/institutions/1/discover');
    expect(started.status).toBe(202);
    expect(started.body.discovery.status).toBe('running');

    const discovery = await waitForDiscovery(agent);
    expect(discovery).toMatchObject({
      status: 'completed',
      error: null,
      summary: { source: 'crawler', origin: ORIGIN, found: 5, created: 5, authenticated: 1 },
    });

    const routes = await listRoutes(agent);
    const byUrl = Object.fromEntries(routes.map((r) => [r.normalizedUrl, r]));
    expect(byUrl[ORIGIN]).toMatchObject({
      functionKey: 'home',
      status: 'suggested',
      source: 'crawler',
    });
    expect(byUrl[`${ORIGIN}/ingresso`]).toMatchObject({
      functionKey: 'admission',
      status: 'suggested',
    });
    expect(byUrl[`${ORIGIN}/biblioteca`]?.functionKey).toBe('library');
    expect(byUrl[`${ORIGIN}/noticias`]?.functionKey).toBeNull();
    // Indícios da descoberta, para ordenar e mostrar as candidatas.
    expect(byUrl[`${ORIGIN}/ingresso`]).toMatchObject({
      title: 'Processo seletivo',
      linkText: 'Ingresso',
    });
    expect(byUrl[`${ORIGIN}/ingresso`]?.relevance).toBeGreaterThan(50);
    expect(byUrl[`${ORIGIN}/noticias`]).toMatchObject({ relevance: null, linkText: 'link' });
    expect(discovery.summary?.withSuggestion).toBe(3);
    expect(byUrl[`${ORIGIN}/suap`]?.status).toBe('authenticated');
    // Nada é confirmado sem o auditor.
    expect(routes.every((r) => r.confirmedAt === null)).toBe(true);
  });

  it('nova descoberta preserva as decisões do auditor e acrescenta só o que é novo', async () => {
    const { agent } = await setup();
    await agent.post('/api/v1/institutions/1/discover');
    await waitForDiscovery(agent);

    const ingresso = (await listRoutes(agent)).find(
      (r) => r.normalizedUrl === `${ORIGIN}/ingresso`,
    );
    await agent
      .patch(`/api/v1/routes/${ingresso?.id}`)
      .send({ status: 'confirmed', functionKey: 'admission' });
    const noticias = (await listRoutes(agent)).find(
      (r) => r.normalizedUrl === `${ORIGIN}/noticias`,
    );
    await agent
      .patch(`/api/v1/routes/${noticias?.id}`)
      .send({ status: 'excluded', exclusionReason: 'Listagem de notícias' });

    discover = crawl(iftmSite(['/nova']));
    await agent.post('/api/v1/institutions/1/discover');
    const second = await waitForDiscovery(agent);
    expect(second.summary).toMatchObject({ found: 6, created: 1 });

    const routes = await listRoutes(agent);
    const byUrl = Object.fromEntries(routes.map((r) => [r.normalizedUrl, r]));
    expect(routes).toHaveLength(6);
    expect(byUrl[`${ORIGIN}/ingresso`]?.status).toBe('confirmed');
    expect(byUrl[`${ORIGIN}/noticias`]).toMatchObject({
      status: 'excluded',
      exclusionReason: 'Listagem de notícias',
    });
    expect(byUrl[`${ORIGIN}/nova`]?.status).toBe('suggested');
  });

  it('mostra o andamento enquanto roda e o limpa ao terminar', async () => {
    let release: (value: DiscoveryResult) => void = () => {};
    let report: Parameters<DiscoverFn>[2];
    discover = (_domain, _checkUrls, onProgress) => {
      report = onProgress;
      return new Promise((resolve) => (release = resolve));
    };
    const { agent } = await setup();

    const started = await agent.post('/api/v1/institutions/1/discover');
    expect(started.body.discovery.progress).toEqual({
      phase: 'robots',
      visited: 0,
      planned: null,
    });
    report?.({ phase: 'pages', visited: 12, planned: 200 });
    const running = await agent.get('/api/v1/institutions/1/discovery');
    expect(running.body.discovery.progress).toEqual({ phase: 'pages', visited: 12, planned: 200 });

    release({
      origin: ORIGIN,
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
    expect(await waitForDiscovery(agent)).toMatchObject({ status: 'completed', progress: null });
  });

  it('não inicia duas descobertas ao mesmo tempo na mesma instituição', async () => {
    let release: (value: DiscoveryResult) => void = () => {};
    discover = () => new Promise((resolve) => (release = resolve));
    const { agent } = await setup();

    expect((await agent.post('/api/v1/institutions/1/discover')).status).toBe(202);
    const second = await agent.post('/api/v1/institutions/1/discover');
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('DISCOVERY_RUNNING');

    release({
      origin: ORIGIN,
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
    expect((await waitForDiscovery(agent)).status).toBe('completed');
  });

  it('registra a falha sem gravar rotas', async () => {
    discover = async () => {
      throw new Error('A página inicial respondeu HTTP 503.');
    };
    const { agent } = await setup();
    await agent.post('/api/v1/institutions/1/discover');
    const discovery = await waitForDiscovery(agent);
    expect(discovery).toMatchObject({
      status: 'failed',
      error: 'A página inicial respondeu HTTP 503.',
    });
    expect(await listRoutes(agent)).toEqual([]);
  });

  it('recusa instituição inativa e crawler sem e-mail de contato', async () => {
    const { agent } = await setup();
    await agent.patch('/api/v1/institutions/1').send({ active: false });
    expect((await agent.post('/api/v1/institutions/1/discover')).body.error.code).toBe(
      'INSTITUTION_INACTIVE',
    );

    const unconfigured = createApp({ db, discover: null });
    const other = request.agent(unconfigured);
    await other
      .post('/api/v1/auth/login')
      .send({ email: 'auditora@iftm.edu.br', password: 'senha-bem-longa-123' });
    await other.patch('/api/v1/institutions/1').send({ active: true });
    const res = await other.post('/api/v1/institutions/1/discover');
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('CRAWLER_NOT_CONFIGURED');
  });

  it('responde 404 para instituição inexistente', async () => {
    const { agent } = await setup();
    expect((await agent.post('/api/v1/institutions/999/discover')).status).toBe(404);
    expect((await agent.get('/api/v1/institutions/999/routes')).status).toBe(404);
  });
});

describe('PATCH /api/v1/routes/:id', () => {
  async function discovered() {
    const ctx = await setup();
    await ctx.agent.post('/api/v1/institutions/1/discover');
    await waitForDiscovery(ctx.agent);
    const routes = await listRoutes(ctx.agent);
    const noticias = routes.find((r) => r.normalizedUrl === `${ORIGIN}/noticias`);
    if (!noticias) throw new Error('rota ausente');
    return { ...ctx, id: noticias.id };
  }

  it('confirma atribuindo função', async () => {
    const { agent, id } = await discovered();
    const res = await agent
      .patch(`/api/v1/routes/${id}`)
      .send({ status: 'confirmed', functionKey: 'student_support' });
    expect(res.status).toBe(200);
    expect(res.body.route).toMatchObject({ status: 'confirmed', functionKey: 'student_support' });
    expect(res.body.route.confirmedAt).not.toBeNull();
  });

  it('exclui só com motivo e limpa o motivo ao voltar para sugestão', async () => {
    const { agent, id } = await discovered();
    expect((await agent.patch(`/api/v1/routes/${id}`).send({ status: 'excluded' })).status).toBe(
      400,
    );

    const excluded = await agent
      .patch(`/api/v1/routes/${id}`)
      .send({ status: 'excluded', exclusionReason: 'Página duplicada' });
    expect(excluded.body.route).toMatchObject({
      status: 'excluded',
      exclusionReason: 'Página duplicada',
    });

    const back = await agent.patch(`/api/v1/routes/${id}`).send({ status: 'suggested' });
    expect(back.body.route).toMatchObject({
      status: 'suggested',
      exclusionReason: null,
      confirmedAt: null,
    });
  });

  it('remove a função', async () => {
    const { agent } = await discovered();
    const home = (await listRoutes(agent)).find((r) => r.functionKey === 'home');
    const res = await agent.patch(`/api/v1/routes/${home?.id}`).send({ functionKey: null });
    expect(res.body.route.functionKey).toBeNull();
    expect(res.body.route.status).toBe('suggested');
  });

  it('filtra a listagem por situação', async () => {
    const { agent, id } = await discovered();
    await agent.patch(`/api/v1/routes/${id}`).send({ status: 'confirmed' });
    const confirmed = await listRoutes(agent, '?status=confirmed');
    expect(confirmed.map((r) => r.id)).toEqual([id]);
    expect((await agent.get('/api/v1/institutions/1/routes?status=qualquer')).status).toBe(400);
  });

  it('responde 404 para rota inexistente', async () => {
    const { agent } = await setup();
    expect((await agent.patch('/api/v1/routes/999').send({ status: 'confirmed' })).status).toBe(
      404,
    );
  });
});

describe('uma rota confirmada por função', () => {
  async function discovered() {
    const ctx = await setup();
    await ctx.agent.post('/api/v1/institutions/1/discover');
    await waitForDiscovery(ctx.agent);
    const byUrl = Object.fromEntries(
      (await listRoutes(ctx.agent)).map((r) => [r.normalizedUrl, r]),
    );
    return { ...ctx, byUrl };
  }

  it('recusa uma segunda rota confirmada para a mesma função, a menos que seja troca', async () => {
    const { agent, byUrl } = await discovered();
    const ingresso = byUrl[`${ORIGIN}/ingresso`]!;
    const noticias = byUrl[`${ORIGIN}/noticias`]!;
    await agent
      .patch(`/api/v1/routes/${ingresso.id}`)
      .send({ status: 'confirmed', functionKey: 'admission' });

    const conflict = await agent
      .patch(`/api/v1/routes/${noticias.id}`)
      .send({ status: 'confirmed', functionKey: 'admission' });
    expect(conflict.status).toBe(409);
    expect(conflict.body.error).toMatchObject({
      code: 'FUNCTION_ALREADY_CONFIRMED',
      details: { routeId: ingresso.id },
    });

    const swap = await agent
      .patch(`/api/v1/routes/${noticias.id}`)
      .send({ status: 'confirmed', functionKey: 'admission', replaceConfirmed: true });
    expect(swap.status).toBe(200);
    const after = Object.fromEntries((await listRoutes(agent)).map((r) => [r.normalizedUrl, r]));
    expect(after[`${ORIGIN}/ingresso`]).toMatchObject({ status: 'suggested', confirmedAt: null });
    expect(after[`${ORIGIN}/noticias`]).toMatchObject({
      status: 'confirmed',
      functionKey: 'admission',
    });
  });

  it('aceita URL manual do domínio, já confirmada, e recusa outro domínio', async () => {
    const { agent } = await discovered();
    const created = await agent
      .post('/api/v1/institutions/1/routes')
      .send({ url: 'https://www.iftm.edu.br/biblioteca-central/#topo', functionKey: 'library' });
    expect(created.status).toBe(201);
    expect(created.body.route).toMatchObject({
      normalizedUrl: 'https://www.iftm.edu.br/biblioteca-central',
      source: 'manual',
      status: 'confirmed',
      functionKey: 'library',
    });

    const outside = await agent
      .post('/api/v1/institutions/1/routes')
      .send({ url: 'https://gov.br/biblioteca', functionKey: 'library', replaceConfirmed: true });
    expect(outside.status).toBe(422);
    expect(outside.body.error.code).toBe('OUTSIDE_DOMAIN');
  });
});

describe('substituição de rota (3.1.7)', () => {
  it('detecta rota confirmada removida, sugere outra da mesma função e só troca com confirmação', async () => {
    const { agent } = await setup();
    await agent.post('/api/v1/institutions/1/discover');
    await waitForDiscovery(agent);
    const ingresso = (await listRoutes(agent)).find(
      (r) => r.normalizedUrl === `${ORIGIN}/ingresso`,
    )!;
    await agent
      .patch(`/api/v1/routes/${ingresso.id}`)
      .send({ status: 'confirmed', functionKey: 'admission' });

    // O portal mudou: /ingresso some (404) e surge /processo-seletivo.
    discover = crawl(
      fakeSite({
        'https://iftm.edu.br/robots.txt': { redirect: `${ORIGIN}/robots.txt` },
        [`${ORIGIN}/robots.txt`]: { status: 404, body: '' },
        [`${ORIGIN}/`]: { body: html('IFTM', links(['/processo-seletivo', 'Processo seletivo'])) },
        [`${ORIGIN}/processo-seletivo`]: { body: html('Processo seletivo 2027') },
        [`${ORIGIN}/ingresso`]: { status: 404, body: 'não encontrada' },
      }),
    );
    await agent.post('/api/v1/institutions/1/discover');
    const discovery = await waitForDiscovery(agent);
    expect(discovery.replacements).toHaveLength(1);
    const [replacement] = discovery.replacements;
    expect(replacement).toMatchObject({
      routeId: ingresso.id,
      functionKey: 'admission',
      reason: 'not_found',
      httpStatus: 404,
      candidateUrl: `${ORIGIN}/processo-seletivo`,
    });

    // Nada foi aplicado sozinho.
    const before = await listRoutes(agent);
    expect(before.find((r) => r.id === ingresso.id)?.status).toBe('confirmed');

    const res = await agent
      .post(`/api/v1/routes/${ingresso.id}/replace`)
      .send({ newRouteId: replacement!.candidateRouteId });
    expect(res.status).toBe(200);
    expect(res.body.replaced).toMatchObject({
      status: 'excluded',
      replacedByRouteId: replacement!.candidateRouteId,
      exclusionReason: `Substituída por ${ORIGIN}/processo-seletivo`,
    });
    expect(res.body.route).toMatchObject({ status: 'confirmed', functionKey: 'admission' });

    const after = await agent.get('/api/v1/institutions/1/discovery');
    expect(after.body.discovery.replacements).toEqual([]);
  });

  it('redirecionamento permanente sugere o destino', async () => {
    const { agent } = await setup();
    await agent.post('/api/v1/institutions/1/discover');
    await waitForDiscovery(agent);
    const biblioteca = (await listRoutes(agent)).find(
      (r) => r.normalizedUrl === `${ORIGIN}/biblioteca`,
    )!;
    await agent
      .patch(`/api/v1/routes/${biblioteca.id}`)
      .send({ status: 'confirmed', functionKey: 'library' });

    discover = crawl(
      fakeSite({
        'https://iftm.edu.br/robots.txt': { redirect: `${ORIGIN}/robots.txt` },
        [`${ORIGIN}/robots.txt`]: { status: 404, body: '' },
        [`${ORIGIN}/`]: { body: html('IFTM') },
        [`${ORIGIN}/biblioteca`]: { redirect: '/bibliotecas/', status: 308 },
        [`${ORIGIN}/bibliotecas/`]: { body: html('Bibliotecas') },
      }),
    );
    await agent.post('/api/v1/institutions/1/discover');
    const discovery = await waitForDiscovery(agent);
    expect(discovery.replacements[0]).toMatchObject({
      reason: 'moved',
      httpStatus: 308,
      candidateUrl: `${ORIGIN}/bibliotecas`,
    });
  });

  it('só substitui rota confirmada, por outra da mesma instituição', async () => {
    const { agent } = await setup();
    await agent.post('/api/v1/institutions/1/discover');
    await waitForDiscovery(agent);
    const [a, b] = await listRoutes(agent);
    const res = await agent.post(`/api/v1/routes/${a!.id}/replace`).send({ newRouteId: b!.id });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ROUTE_NOT_CONFIRMED');
  });
});

describe('função não encontrada (ADR 0013)', () => {
  const absence = (key: string) => `/api/v1/institutions/1/functions/${key}/absence`;

  it('marca com motivo, lista junto das rotas e desfaz', async () => {
    const { agent } = await setup();
    expect((await agent.put(absence('class_schedule')).send({ reason: 'curto' })).status).toBe(400);
    expect(
      (await agent.put(absence('inexistente')).send({ reason: 'Procurei em tudo.' })).status,
    ).toBe(400);

    const marked = await agent
      .put(absence('class_schedule'))
      .send({ reason: 'Procurei no menu, no mapa do site e na busca.' });
    expect(marked.status).toBe(200);
    expect(marked.body.absence).toMatchObject({
      institutionId: 1,
      functionKey: 'class_schedule',
      reason: 'Procurei no menu, no mapa do site e na busca.',
    });
    const listed = routeListResponseSchema.parse(
      (await agent.get('/api/v1/institutions/1/routes')).body,
    );
    expect(listed.absences.map((a) => a.functionKey)).toEqual(['class_schedule']);

    expect((await agent.delete(absence('class_schedule'))).status).toBe(204);
    const after = routeListResponseSchema.parse(
      (await agent.get('/api/v1/institutions/1/routes')).body,
    );
    expect(after.absences).toEqual([]);
  });

  it('não marca função com rota confirmada; confirmar uma rota desfaz a marcação', async () => {
    const { agent } = await setup();
    await agent.put(absence('library')).send({ reason: 'Não achei no menu principal do portal.' });
    const created = await agent
      .post('/api/v1/institutions/1/routes')
      .send({ url: 'https://iftm.edu.br/biblioteca', functionKey: 'library' });
    expect(created.status).toBe(201);
    const listed = routeListResponseSchema.parse(
      (await agent.get('/api/v1/institutions/1/routes')).body,
    );
    expect(listed.absences).toEqual([]);

    const refused = await agent
      .put(absence('library'))
      .send({ reason: 'Tentando marcar mesmo assim.' });
    expect(refused.status).toBe(409);
    expect(refused.body.error.code).toBe('FUNCTION_ALREADY_CONFIRMED');
  });
});
