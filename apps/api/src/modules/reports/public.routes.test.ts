import {
  auditorInstitutionDetailSchema,
  methodologySchema,
  publicFindingsResponseSchema,
  publicInstitutionDetailSchema,
  publicInstitutionListResponseSchema,
  publicSummarySchema,
  resultsOverviewSchema,
} from '@auditoria-rf/contracts';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import type { DB } from '../../db/client.js';
import { collectionPages, collections, findings, institutions, users } from '../../db/schema.js';
import { loggedInAgent } from '../../test/auth.js';
import { seedInstitutionWithRoutes } from '../../test/collections.js';
import { createTestDatabase } from '../../test/db.js';

let db: DB;
let app: ReturnType<typeof createApp>;

type Validation = 'pending' | 'confirmed' | 'false_positive';

function finishedCollection(
  institutionIds: number[],
  finishedAt: string,
  status: 'completed' | 'partial' | 'cancelled' = 'completed',
) {
  return db
    .insert(collections)
    .values({
      status,
      scopeJson: { institutionIds, functions: null },
      createdBy: 1,
      axeVersion: '4.13.0',
      browserVersion: 'Chromium 153',
      finishedAt: new Date(finishedAt),
    })
    .returning()
    .get();
}

function page(
  collectionId: number,
  routeId: number,
  passes: number,
  violations: number,
  status: 'done' | 'failed' = 'done',
) {
  return db
    .insert(collectionPages)
    .values({ collectionId, routeId, status, passesCount: passes, violationsCount: violations })
    .returning()
    .get();
}

function finding(
  pageId: number,
  ruleId: string,
  selector: string,
  validation: Validation,
  severity: 'critical' | 'moderate' = 'critical',
) {
  db.insert(findings)
    .values({
      collectionPageId: pageId,
      ruleId,
      wcagCriteria: '1.1.1',
      principle: 'perceivable',
      axeImpact: severity === 'critical' ? 'serious' : 'minor',
      severity,
      selector,
      htmlSnippet: `<img class="${selector}">`,
      help: 'Images must have alternative text',
      helpUrl: 'https://dequeuniversity.com/rules/axe/4.13/image-alt',
      fingerprint: `${ruleId}:${selector}:${pageId}`.replace(/:\d+$/, ''),
      validation,
    })
    .run();
}

let ifa: ReturnType<typeof seedInstitutionWithRoutes>;
let ifb: ReturnType<typeof seedInstitutionWithRoutes>;
let ifc: ReturnType<typeof seedInstitutionWithRoutes>;

beforeEach(() => {
  db = createTestDatabase();
  db.insert(users).values({ email: 'a@if.edu.br', name: 'A', passwordHash: 'x' }).run();
  app = createApp({ db, auditor: null, discover: null });

  ifa = seedInstitutionWithRoutes(db, {
    domain: 'if-a.edu.br',
    acronym: 'IFA',
    urls: [{ url: 'https://if-a.edu.br' }, { url: 'https://if-a.edu.br/b' }],
  });
  ifb = seedInstitutionWithRoutes(db, {
    domain: 'if-b.edu.br',
    acronym: 'IFB',
    urls: [{ url: 'https://if-b.edu.br' }],
  });
  ifc = seedInstitutionWithRoutes(db, {
    domain: 'if-c.edu.br',
    acronym: 'IFC',
    urls: [{ url: 'https://if-c.edu.br' }],
  });
  seedInstitutionWithRoutes(db, { domain: 'if-d.edu.br', acronym: 'IFD', urls: [] }); // nunca coletado

  // Coleta antiga: IFA com 50%.
  const old = finishedCollection([ifa.institution.id], '2026-03-01T12:00:00Z');
  page(old.id, ifa.routes[0]!.id, 5, 5);

  // Coleta recente: IFA avaliada; IFB falhou (ausência de dado).
  const recent = finishedCollection(
    [ifa.institution.id, ifb.institution.id],
    '2026-09-12T12:00:00Z',
    'partial',
  );
  const p1 = page(recent.id, ifa.routes[0]!.id, 8, 2);
  const p2 = page(recent.id, ifa.routes[1]!.id, 9, 1);
  page(recent.id, ifb.routes[0]!.id, 0, 0, 'failed');
  // image-alt no cabeçalho, nas duas páginas: confirmado (template).
  finding(p1.id, 'image-alt', 'header img', 'confirmed');
  finding(p2.id, 'image-alt', 'header img', 'confirmed');
  // pendente e falso positivo não aparecem para o público
  finding(p1.id, 'link-name', 'footer a', 'pending', 'moderate');
  finding(p2.id, 'label', '#busca', 'false_positive');

  // Coleta cancelada da IFC não conta.
  const cancelled = finishedCollection([ifc.institution.id], '2026-09-20T12:00:00Z', 'cancelled');
  page(cancelled.id, ifc.routes[0]!.id, 10, 0);
});

describe('API pública', () => {
  it('não exige sessão', async () => {
    expect((await request(app).get('/api/v1/public/institutions')).status).toBe(200);
  });

  it('lista as instituições com a coleta mais recente; falha é ausência de dado', async () => {
    const res = await request(app).get('/api/v1/public/institutions');
    const { institutions: rows } = publicInstitutionListResponseSchema.parse(res.body);
    expect(rows.map((r) => [r.acronym, r.status])).toEqual([
      ['IFA', 'evaluated'],
      ['IFB', 'no_data'],
      ['IFC', 'not_collected'],
      ['IFD', 'not_collected'],
    ]);

    const [ifaRow, ifbRow] = rows;
    // Página 2: a regra "label" só tem falso positivo → vira passe (10/10). Página 1: 8/10.
    expect(ifaRow!.conformity).toBeCloseTo((0.8 + 1) / 2);
    expect(ifaRow).toMatchObject({
      classification: 'good',
      problems: 1,
      criticalProblems: 1,
      templateProblems: 1,
      pendingValidation: 1,
      pagesEvaluated: 2,
      pagesTotal: 2,
      collectedAt: '2026-09-12T12:00:00.000Z',
    });
    expect(ifbRow).toMatchObject({
      conformity: null,
      problems: null,
      pagesEvaluated: 0,
      pagesTotal: 1,
    });
  });

  it('resumo: média só das avaliadas', async () => {
    const summary = publicSummarySchema.parse(
      (await request(app).get('/api/v1/public/summary')).body,
    );
    expect(summary).toMatchObject({
      lastCollectionAt: '2026-09-12T12:00:00.000Z',
      institutionsTotal: 4,
      institutionsEvaluated: 1,
    });
    expect(summary.averageConformity).toBeCloseTo(0.9);
  });

  it('detalhe com histórico de coletas', async () => {
    const res = await request(app).get(`/api/v1/public/institutions/${ifa.institution.id}`);
    const detail = publicInstitutionDetailSchema.parse(res.body);
    expect(detail.history.map((h) => [h.collectedAt.slice(0, 10), h.conformity])).toEqual([
      ['2026-03-01', 0.5],
      ['2026-09-12', 0.9],
    ]);
  });

  it('achados: só problemas confirmados, em português, com exemplo', async () => {
    const res = await request(app).get(
      `/api/v1/public/institutions/${ifa.institution.id}/findings`,
    );
    const { problems } = publicFindingsResponseSchema.parse(res.body);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({
      ruleId: 'image-alt',
      title: 'Imagens devem ter texto alternativo',
      template: true,
      pages: 2,
      occurrences: 2,
      example: { pageUrl: 'https://if-a.edu.br', selector: 'header img' },
    });
  });

  it('instituição sem dado não tem achados; inativa ou inexistente dá 404', async () => {
    const empty = await request(app).get(
      `/api/v1/public/institutions/${ifb.institution.id}/findings`,
    );
    expect(empty.body.problems).toEqual([]);

    db.update(institutions)
      .set({ active: false })
      .where(eq(institutions.id, ifc.institution.id))
      .run();
    expect(
      (await request(app).get(`/api/v1/public/institutions/${ifc.institution.id}`)).status,
    ).toBe(404);
    expect((await request(app).get('/api/v1/public/institutions/999')).status).toBe(404);
  });

  it('metodologia: versões da última coleta e limiares', async () => {
    const methodology = methodologySchema.parse(
      (await request(app).get('/api/v1/public/methodology')).body,
    );
    expect(methodology).toMatchObject({
      axeVersion: '4.13.0',
      browserVersion: 'Chromium 153',
      lastCollectionAt: '2026-09-12T12:00:00.000Z',
      thresholds: { good: 0.75, partial: 0.5 },
      templateThreshold: 0.8,
      templateMinPages: 2,
    });
    expect(methodology.axeTags).toContain('wcag22aa');
  });
});

describe('exportação de dados abertos (CSV)', () => {
  const parse = (text: string) =>
    text
      .replace(/^\uFEFF/, '')
      .trim()
      .split('\r\n')
      .map((line) => line.split(','));

  it('instituições: uma linha por instituição, sem dado vazio (não 0)', async () => {
    const res = await request(app).get('/api/v1/public/export.csv');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toContain('auditoria-rf-instituicoes.csv');
    expect(res.text.startsWith('\uFEFF')).toBe(true);
    const [header, ...rows] = parse(res.text);
    expect(header!.slice(0, 5)).toEqual(['instituicao_id', 'sigla', 'nome', 'dominio', 'situacao']);
    const bySigla = Object.fromEntries(rows.map((r) => [r[1], r]));
    const col = (name: string) => header!.indexOf(name);
    expect(bySigla.IFA![col('situacao')]).toBe('avaliado');
    expect(bySigla.IFA![col('conformidade')]).toBe('0.9000');
    expect(bySigla.IFA![col('problemas_confirmados')]).toBe('1');
    expect(bySigla.IFA![col('axe_versao')]).toBe('4.13.0');
    expect(bySigla.IFB![col('situacao')]).toBe('sem_dado');
    expect(bySigla.IFB![col('conformidade')]).toBe('');
  });

  it('problemas: só confirmados', async () => {
    const res = await request(app).get('/api/v1/public/export.csv?conjunto=problemas');
    const [header, ...rows] = parse(res.text);
    expect(header![2]).toBe('regra');
    expect(rows.map((r) => r[2])).toEqual(['image-alt']);
    expect((await request(app).get('/api/v1/public/export.csv?conjunto=outro')).status).toBe(400);
  });

  it('dicionário de dados cobre todas as colunas', async () => {
    const dictionary = parse((await request(app).get('/api/v1/public/export-dictionary.csv')).text);
    const inst = parse((await request(app).get('/api/v1/public/export.csv')).text)[0]!;
    const documented = dictionary.filter((r) => r[0] === 'instituicoes').map((r) => r[1]);
    expect(documented).toEqual(inst);
  });
});

describe('resultados do auditor (4.1, 4.2, 4.3)', () => {
  it('exige sessão; conta tudo que não é falso positivo e mostra a camada manual', async () => {
    expect((await request(app).get('/api/v1/reports/overview')).status).toBe(401);
    const agent = await loggedInAgent(app, db);
    const overview = resultsOverviewSchema.parse(
      (await agent.get('/api/v1/reports/overview')).body,
    );
    const ifaRow = overview.institutions.find((i) => i.acronym === 'IFA')!;
    // confirmado + pendente = 2 problemas (o falso positivo não conta)
    expect(ifaRow).toMatchObject({ problems: 2, inspection: 'not_in_sample', tasks: null });
    expect(overview.institutions.find((i) => i.acronym === 'IFB')).toMatchObject({
      status: 'no_data',
      inspection: null,
    });
    expect(overview.distinctProblems).toBe(2);

    const detail = auditorInstitutionDetailSchema.parse(
      (await agent.get(`/api/v1/reports/institutions/${ifa.institution.id}`)).body,
    );
    expect(detail.problems.map((p) => [p.ruleId, p.validation])).toEqual([
      ['image-alt', 'confirmed'],
      ['link-name', 'pending'],
    ]);
    expect(detail.manual).toEqual({ tasks: [], barriers: [] });
  });
});
