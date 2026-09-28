import {
  auditorInstitutionDetailSchema,
  indicatorsSchema,
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
import {
  collectionPages,
  collections,
  findings,
  institutions,
  pageFunctions,
  routes,
  users,
} from '../../db/schema.js';
import { seedReferenceData } from '../../db/seeds/seed.js';
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
  functions: string[] | null = null,
) {
  return db
    .insert(collections)
    .values({
      status,
      scopeJson: { institutionIds, functions },
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
  failure: { error?: string; httpStatus?: number } = {},
) {
  // A página herda a função da rota, como na coleta de verdade.
  const functionId = db.select().from(routes).where(eq(routes.id, routeId)).get()?.functionId;
  return db
    .insert(collectionPages)
    .values({
      collectionId,
      routeId,
      functionId,
      status,
      passesCount: passes,
      violationsCount: violations,
      // Casos que o axe não decide: fora do cálculo, mas contados para a revisão humana.
      incompleteCount: status === 'done' ? 2 : 0,
      error: failure.error ?? null,
      httpStatus: failure.httpStatus ?? null,
    })
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
  seedReferenceData(db); // funções de página e tarefas-alvo
  db.insert(users).values({ email: 'a@if.edu.br', name: 'A', passwordHash: 'x' }).run();
  app = createApp({ db, auditor: null, discover: null });

  ifa = seedInstitutionWithRoutes(db, {
    domain: 'if-a.edu.br',
    acronym: 'IFA',
    urls: [
      { url: 'https://if-a.edu.br', functionKey: 'home' },
      { url: 'https://if-a.edu.br/b', functionKey: 'library' },
    ],
  });
  ifb = seedInstitutionWithRoutes(db, {
    domain: 'if-b.edu.br',
    acronym: 'IFB',
    urls: [{ url: 'https://if-b.edu.br', functionKey: 'home' }],
  });
  ifc = seedInstitutionWithRoutes(db, {
    domain: 'if-c.edu.br',
    acronym: 'IFC',
    urls: [{ url: 'https://if-c.edu.br', functionKey: 'home' }],
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
  page(recent.id, ifb.routes[0]!.id, 0, 0, 'failed', {
    error:
      'A página redirecionou para validate.perfdrive.com, fora do domínio da instituição (if-b.edu.br): provável proteção contra robôs. A ferramenta não contorna bloqueios; o portal fica sem dado.',
  });
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
      reviewNeeded: 4,
      pagesEvaluated: 2,
      pagesTotal: 2,
      collectedAt: '2026-09-12T12:00:00.000Z',
    });
    expect(ifaRow!.noDataReason).toBeNull();
    expect(ifbRow).toMatchObject({
      // O motivo da ausência: bloqueio não é portal fora do ar (ADR 0016).
      noDataReason: 'blocked',
      conformity: null,
      problems: null,
      reviewNeeded: null,
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

  it('compara no núcleo comum e mostra a cobertura (ADR 0013)', async () => {
    // IFC ganha uma coleta com escopo explícito: página inicial encontrada, biblioteca não.
    const withScope = finishedCollection(
      [ifc.institution.id],
      '2026-09-21T12:00:00Z',
      'completed',
      ['home', 'library'],
    );
    const pc = page(withScope.id, ifc.routes[0]!.id, 6, 4);
    finding(pc.id, 'image-alt', 'main img', 'confirmed');

    const { institutions: rows, coreFunctions } = publicInstitutionListResponseSchema.parse(
      (await request(app).get('/api/v1/public/institutions')).body,
    );
    // Só a página inicial foi avaliada nas duas: é o que se compara.
    expect(coreFunctions).toEqual(['home']);
    const byAcronym = Object.fromEntries(rows.map((r) => [r.acronym, r]));
    // IFA: no núcleo (página inicial) 80%, 1 problema; em todas as páginas, 90% (o falso positivo
    // da página 2 conta como passe) e 1 problema.
    expect(byAcronym.IFA).toMatchObject({ problems: 1, pagesEvaluated: 1, coverage: null });
    expect(byAcronym.IFA!.conformity).toBeCloseTo(0.8);
    expect(byAcronym.IFA!.overall).toMatchObject({ problems: 1, pagesEvaluated: 2 });
    expect(byAcronym.IFA!.overall!.conformity).toBeCloseTo(0.9);
    // IFC: 60% no núcleo; cobertura 1 de 2, biblioteca não encontrada (não vira 0%).
    expect(byAcronym.IFC).toMatchObject({
      problems: 1,
      coverage: { found: 1, expected: 2, missing: ['library'] },
    });
    expect(byAcronym.IFC!.conformity).toBeCloseTo(0.6);
    // Ranking pelo núcleo comum.
    expect(rows.slice(0, 2).map((r) => r.acronym)).toEqual(['IFA', 'IFC']);

    const summary = publicSummarySchema.parse(
      (await request(app).get('/api/v1/public/summary')).body,
    );
    expect(summary.coreFunctions).toEqual(['home']);
    expect(summary.averageConformity).toBeCloseTo(0.7);
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
    expect(bySigla.IFB![col('motivo_sem_dado')]).toBe('bloqueio');
    expect(bySigla.IFA![col('motivo_sem_dado')]).toBe('');
  });

  it('problemas: só confirmados', async () => {
    const res = await request(app).get('/api/v1/public/export.csv?conjunto=problemas');
    const [header, ...rows] = parse(res.text);
    expect(header![2]).toBe('regra');
    expect(rows.map((r) => r[2])).toEqual(['image-alt']);
    expect((await request(app).get('/api/v1/public/export.csv?conjunto=outro')).status).toBe(400);
  });

  it('exportação tem limite de requisições por IP', async () => {
    for (let i = 0; i < 20; i++) {
      expect((await request(app).get('/api/v1/public/export-dictionary.csv')).status).toBe(200);
    }
    const blocked = await request(app).get('/api/v1/public/export.csv');
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('TOO_MANY_REQUESTS');
    // A navegação pública segue com o seu próprio limite, mais folgado.
    expect((await request(app).get('/api/v1/public/summary')).status).toBe(200);
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

describe('indicadores da pesquisa (auditor)', () => {
  it('taxa de confirmação por regra, por problema distinto, na coleta mais recente', async () => {
    expect((await request(app).get('/api/v1/reports/indicators')).status).toBe(401);
    const agent = await loggedInAgent(app, db);
    const { collections: count, rules } = indicatorsSchema.parse(
      (await agent.get('/api/v1/reports/indicators')).body,
    );
    // IFA e IFB estão na mesma coleta recente; a antiga não entra.
    expect(count).toBe(1);
    expect(rules.map(({ title: _t, ...r }) => r)).toEqual([
      // "header img" nas duas páginas é um problema só.
      {
        ruleId: 'image-alt',
        problems: 1,
        confirmed: 1,
        falsePositive: 0,
        pending: 0,
        confirmationRate: 1,
      },
      {
        ruleId: 'label',
        problems: 1,
        confirmed: 0,
        falsePositive: 1,
        pending: 0,
        confirmationRate: 0,
      },
      {
        ruleId: 'link-name',
        problems: 1,
        confirmed: 0,
        falsePositive: 0,
        pending: 1,
        confirmationRate: null,
      },
    ]);
    expect(rules[0]!.title).not.toBe('Images must have alternative text'); // em português

    const csv = await agent.get('/api/v1/reports/indicators/rules.csv');
    expect(csv.headers['content-type']).toMatch(/text\/csv/);
    const lines = csv.text
      .replace(/^\uFEFF/, '')
      .trim()
      .split('\r\n');
    expect(lines[0]).toBe(
      'regra,titulo,problemas,confirmados,falsos_positivos,pendentes,taxa_confirmacao',
    );
    expect(lines[1]).toMatch(/^image-alt,.*,1,1,0,0,1\.0000$/);
    expect(lines[3]).toMatch(/^link-name,.*,1,0,0,1,$/);
    const dictionary = (await agent.get('/api/v1/reports/indicators/rules-dictionary.csv')).text;
    for (const column of lines[0]!.split(',')) expect(dictionary).toContain(`${column},`);
  });

  it('acerto da sugestão de função nas rotas confirmadas', async () => {
    const { institution: ife } = seedInstitutionWithRoutes(db, {
      domain: 'if-e.edu.br',
      acronym: 'IFE',
      urls: [],
      markOthersAbsent: false,
    });
    const functionId = (key: string) =>
      db.select().from(pageFunctions).where(eq(pageFunctions.key, key)).get()!.id;
    const discovered = (url: string, key: string, title: string | null) =>
      db
        .insert(routes)
        .values({
          institutionId: ife.id,
          url,
          normalizedUrl: url,
          source: 'crawler',
          status: 'confirmed',
          functionId: functionId(key),
          title,
        })
        .run();
    // O portal fica em portal.if-e.edu.br (a página inicial redireciona para lá): é a origem do
    // rastreamento, e não um subdomínio de fora.
    discovered('https://portal.if-e.edu.br', 'home', 'Início'); // acerto: a raiz do portal
    discovered('https://portal.if-e.edu.br/processo-seletivo', 'admission', 'Processo seletivo');
    discovered('https://biblioteca.if-e.edu.br', 'library', null); // acerto pelo subdomínio
    discovered('https://portal.if-e.edu.br/biblioteca', 'courses', 'Biblioteca'); // sugeria outra
    discovered('https://portal.if-e.edu.br/pagina-123', 'contact', 'Página'); // sem sugestão

    const agent = await loggedInAgent(app, db);
    const { suggestions } = indicatorsSchema.parse(
      (await agent.get('/api/v1/reports/indicators')).body,
    );
    const row = (key: string) => suggestions.find((s) => s.functionKey === key);
    expect(row('admission')).toMatchObject({ discovered: 1, hits: 1, otherFunction: 0 });
    expect(row('library')).toMatchObject({ discovered: 1, hits: 1, manual: 1 });
    expect(row('courses')).toMatchObject({ discovered: 1, hits: 0, otherFunction: 1 });
    expect(row('contact')).toMatchObject({ discovered: 1, hits: 0, noSuggestion: 1 });
    // Rotas das fixtures foram informadas à mão; IFD marcou tudo como não encontrado.
    expect(row('home')).toMatchObject({ discovered: 1, hits: 1, manual: 3, absent: 1 });
    expect(suggestions).toHaveLength(13);
  });
});

describe('análise do agrupamento de problemas', () => {
  it('compara regra + seletor com outras chaves, por instituição da coleta', () => {
    const recent = db.select().from(collections).where(eq(collections.status, 'partial')).get()!;
    const report = app.services.indicators.fingerprintReport(recent.id);
    expect(report.map((r) => r.acronym)).toEqual(['IFA', 'IFB']);
    const ifaReport = report[0]!.analysis;
    expect(ifaReport.pagesEvaluated).toBe(2);
    // "header img" nas duas páginas: um problema de template em qualquer chave.
    expect(ifaReport.byKey.selector).toEqual({ distinct: 3, template: 1 });
    expect(ifaReport.byKey.html).toEqual({ distinct: 3, template: 1 });
    expect(report[1]!.analysis).toMatchObject({ pagesEvaluated: 0, split: [], merged: [] });
  });
});
