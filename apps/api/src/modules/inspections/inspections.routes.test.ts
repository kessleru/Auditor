import {
  inspectionFindingsSchema,
  inspectionSummarySchema,
  portalAssistiveSchema,
  portalTasksSchema,
} from '@auditoria-rf/contracts';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import type { DB } from '../../db/client.js';
import { collectionPages, collections, findings } from '../../db/schema.js';
import { seed } from '../../db/seeds/seed.js';
import { loggedInAgent } from '../../test/auth.js';
import { seedInstitutionWithRoutes } from '../../test/collections.js';
import { createTestDatabase } from '../../test/db.js';

let db: DB;
let agent: Awaited<ReturnType<typeof loggedInAgent>>;
let app: ReturnType<typeof createApp>;
let collectionId: number;
let ifa: ReturnType<typeof seedInstitutionWithRoutes>;
let ifb: ReturnType<typeof seedInstitutionWithRoutes>;
let pages: { id: number }[];

function finding(pageId: number, ruleId: string, selector: string) {
  return db
    .insert(findings)
    .values({
      collectionPageId: pageId,
      ruleId,
      wcagCriteria: '1.1.1',
      principle: 'perceivable',
      axeImpact: 'serious',
      severity: 'critical',
      selector,
      htmlSnippet: `<img class="${selector}">`,
      help: 'Images must have alternative text',
      helpUrl: 'https://dequeuniversity.com/rules/axe/4.13/image-alt',
      fingerprint: `${ruleId}|${selector}`,
    })
    .returning()
    .get();
}

beforeEach(async () => {
  db = createTestDatabase();
  seed(db);
  app = createApp({ db, auditor: null, discover: null });
  agent = await loggedInAgent(app, db);

  ifa = seedInstitutionWithRoutes(db, {
    domain: 'if-a.edu.br',
    acronym: 'IFA',
    urls: [
      { url: 'https://if-a.edu.br', functionKey: 'home' },
      { url: 'https://if-a.edu.br/ingresso', functionKey: 'admission' },
    ],
  });
  ifb = seedInstitutionWithRoutes(db, {
    domain: 'if-b.edu.br',
    acronym: 'IFB',
    urls: [{ url: 'https://if-b.edu.br', functionKey: 'home' }],
  });

  const collection = db
    .insert(collections)
    .values({
      status: 'partial',
      scopeJson: {
        institutionIds: [ifa.institution.id, ifb.institution.id],
        functions: ['home', 'admission'],
      },
      createdBy: 1,
      finishedAt: new Date('2026-09-12T12:00:00Z'),
    })
    .returning()
    .get();
  collectionId = collection.id;
  pages = [
    db
      .insert(collectionPages)
      .values({
        collectionId,
        routeId: ifa.routes[0]!.id,
        status: 'done',
        passesCount: 8,
        violationsCount: 2,
        functionId: 1,
      })
      .returning()
      .get(),
    db
      .insert(collectionPages)
      .values({
        collectionId,
        routeId: ifa.routes[1]!.id,
        status: 'done',
        passesCount: 9,
        violationsCount: 1,
        functionId: 2,
      })
      .returning()
      .get(),
    db
      .insert(collectionPages)
      .values({ collectionId, routeId: ifb.routes[0]!.id, status: 'failed' })
      .returning()
      .get(),
  ];
  // Cabeçalho nas duas páginas (template) e um problema só da página inicial.
  finding(pages[0]!.id, 'image-alt', 'header img');
  finding(pages[1]!.id, 'image-alt', 'header img');
  finding(pages[0]!.id, 'link-name', 'main a');
});

const summary = async () =>
  inspectionSummarySchema.parse(
    (await agent.get(`/api/v1/collections/${collectionId}/inspection-summary`)).body,
  );
const selectSample = (ids: number[]) =>
  agent.put(`/api/v1/collections/${collectionId}/inspection-sample`).send({ institutionIds: ids });

describe('subamostra (tela 3.0)', () => {
  it('só coleta terminada; lista candidatos e portais sem dado', async () => {
    db.update(collections).set({ status: 'running' }).where(eq(collections.id, collectionId)).run();
    expect((await agent.get(`/api/v1/collections/${collectionId}/inspection-summary`)).status).toBe(
      409,
    );
    db.update(collections).set({ status: 'partial' }).where(eq(collections.id, collectionId)).run();

    const initial = await summary();
    expect(initial.sample).toEqual([]);
    expect(initial.candidates.map((c) => c.acronym)).toEqual(['IFA']);
    expect(initial.withoutData.map((c) => c.acronym)).toEqual(['IFB']);
  });

  it('o auditor escolhe só portais avaliados', async () => {
    const invalid = await selectSample([ifb.institution.id]);
    expect(invalid.status).toBe(422);
    expect(invalid.body.error.code).toBe('NOT_EVALUATED');

    const ok = await selectSample([ifa.institution.id]);
    expect(ok.status).toBe(200);
    const [portal] = inspectionSummarySchema.parse(ok.body).sample;
    expect(portal).toMatchObject({
      acronym: 'IFA',
      pagesEvaluated: 2,
      findings: { problems: 2, pending: 2, confirmed: 0, falsePositive: 0 },
      tasks: { done: 0, total: 2 },
      assistive: { done: 0, total: 2 },
      status: 'not_started',
    });
  });

  it('exige sessão', async () => {
    expect(
      (await request(app).get(`/api/v1/collections/${collectionId}/inspection-summary`)).status,
    ).toBe(401);
  });
});

describe('validação dos achados (tela 3.3)', () => {
  it('só para portal da subamostra; template primeiro, depois por página', async () => {
    const url = `/api/v1/collections/${collectionId}/institutions/${ifa.institution.id}/findings`;
    expect((await agent.get(url)).body.error.code).toBe('NOT_IN_SAMPLE');
    await selectSample([ifa.institution.id]);

    const result = inspectionFindingsSchema.parse((await agent.get(url)).body);
    expect(result.counts).toEqual({ problems: 2, confirmed: 0, falsePositive: 0, pending: 2 });
    expect(
      result.groups.map((g) => [g.kind, g.page?.url ?? null, g.problems.map((p) => p.ruleId)]),
    ).toEqual([
      ['template', null, ['image-alt']],
      ['page', 'https://if-a.edu.br', ['link-name']],
    ]);
    expect(result.groups[0]!.problems[0]).toMatchObject({
      title: 'Imagens devem ter texto alternativo',
      pages: 2,
      occurrences: 2,
      template: true,
    });
  });

  it('valida o problema inteiro; falso positivo exige justificativa e é definitivo', async () => {
    await selectSample([ifa.institution.id]);
    const url = `/api/v1/collections/${collectionId}/institutions/${ifa.institution.id}/findings`;
    const { groups } = inspectionFindingsSchema.parse((await agent.get(url)).body);
    const template = groups[0]!.problems[0]!;
    const other = groups[1]!.problems[0]!;

    const confirm = await agent
      .patch(`/api/v1/findings/${template.findingId}/validation`)
      .send({ validation: 'confirmed' });
    expect(confirm.status).toBe(200);
    // Os dois achados do mesmo fingerprint ficam confirmados.
    const rows = db
      .select()
      .from(findings)
      .where(eq(findings.fingerprint, 'image-alt|header img'))
      .all();
    expect(rows.map((r) => r.validation)).toEqual(['confirmed', 'confirmed']);
    expect(rows[0]!.validatedBy).toBe(1);

    const short = await agent
      .patch(`/api/v1/findings/${other.findingId}/validation`)
      .send({ validation: 'false_positive', note: 'curta' });
    expect(short.status).toBe(400);
    const fp = await agent.patch(`/api/v1/findings/${other.findingId}/validation`).send({
      validation: 'false_positive',
      note: 'O link tem nome via aria-label no elemento pai.',
    });
    expect(fp.status).toBe(200);
    const final = await agent
      .patch(`/api/v1/findings/${other.findingId}/validation`)
      .send({ validation: 'confirmed' });
    expect(final.status).toBe(409);
    expect(final.body.error.code).toBe('FALSE_POSITIVE_FINAL');

    const after = inspectionFindingsSchema.parse((await agent.get(url)).body);
    expect(after.counts).toEqual({ problems: 2, confirmed: 1, falsePositive: 1, pending: 0 });
    expect(after.groups[1]!.problems[0]!.validationNote).toBe(
      'O link tem nome via aria-label no elemento pai.',
    );
  });
});

describe('tarefas-alvo (tela 3.1)', () => {
  it('lista as tarefas das funções da coleta e registra uma por tarefa', async () => {
    await selectSample([ifa.institution.id]);
    const url = `/api/v1/collections/${collectionId}/institutions/${ifa.institution.id}/tasks`;
    const { tasks } = portalTasksSchema.parse((await agent.get(url)).body);
    expect(tasks.map((t) => t.task.functionKey)).toEqual(['home', 'admission']);
    const taskId = tasks[1]!.task.id;
    const base = {
      collectionId,
      institutionId: ifa.institution.id,
      taskId,
      interactions: 9,
      durationSeconds: 252,
      depth: 4,
      path: ['Início', 'Institucional', 'PRAE', 'Editais'],
    };

    const incomplete = await agent
      .post('/api/v1/task-inspections')
      .send({ ...base, result: 'interrupted', note: 'x' });
    expect(incomplete.status).toBe(400);

    const saved = await agent.post('/api/v1/task-inspections').send({
      ...base,
      result: 'interrupted',
      heuristic: 'H2',
      severity: 'moderate',
      note: 'Edital sob a sigla PRAE.',
    });
    expect(saved.status).toBe(200);
    expect(saved.body.inspection).toMatchObject({
      result: 'interrupted',
      heuristic: 'H2',
      path: base.path,
    });

    const redo = await agent
      .post('/api/v1/task-inspections')
      .send({ ...base, result: 'completed', heuristic: 'H1', severity: 'critical' });
    expect(redo.body.inspection).toMatchObject({
      id: saved.body.inspection.id,
      result: 'completed',
      heuristic: null,
      severity: null,
    });

    const after = portalTasksSchema.parse((await agent.get(url)).body);
    expect(after.tasks[1]!.inspection?.result).toBe('completed');
    expect((await summary()).sample[0]).toMatchObject({
      tasks: { done: 1, total: 2 },
      status: 'in_progress',
    });

    const libraryTask = (await agent.get('/api/v1/target-tasks')).body.tasks.find(
      (t: { functionKey: string }) => t.functionKey === 'library',
    );
    const outOfScope = await agent
      .post('/api/v1/task-inspections')
      .send({ ...base, taskId: libraryTask.id, result: 'completed' });
    expect(outOfScope.body.error.code).toBe('TASK_NOT_IN_SCOPE');
  });

  it('cadastra tarefa-alvo nova', async () => {
    const res = await agent.post('/api/v1/target-tasks').send({
      title: 'Calendário acadêmico',
      description: 'Encontrar o calendário acadêmico do semestre.',
      functionKey: 'home',
    });
    expect(res.status).toBe(201);
    expect(res.body.task).toMatchObject({ functionKey: 'home', active: true });
  });
});

describe('verificação assistiva (tela 3.2) e situação do portal', () => {
  it('cinco verificações por página; barreira exige severidade e descrição; portal concluído', async () => {
    await selectSample([ifa.institution.id]);
    const url = `/api/v1/collections/${collectionId}/institutions/${ifa.institution.id}/assistive-checks`;
    const { pages: list } = portalAssistiveSchema.parse((await agent.get(url)).body);
    expect(list).toHaveLength(2);
    expect(list[0]!.checks.map((c) => [c.kind, c.state])).toEqual([
      ['keyboard', 'pending'],
      ['screen_reader', 'pending'],
      ['zoom_200', 'pending'],
      ['captions', 'pending'],
      ['contrast', 'pending'],
    ]);

    const bad = await agent
      .put(`/api/v1/assistive-checks/${pages[0]!.id}/keyboard`)
      .send({ state: 'barrier' });
    expect(bad.status).toBe(400);
    const barrier = await agent
      .put(`/api/v1/assistive-checks/${pages[0]!.id}/keyboard`)
      .send({ state: 'barrier', severity: 'critical', note: 'Menu não recebe foco.' });
    expect(barrier.body.check).toMatchObject({ state: 'barrier', severity: 'critical' });
    expect(
      (await agent.put(`/api/v1/assistive-checks/${pages[2]!.id}/keyboard`).send({ state: 'pass' }))
        .status,
    ).toBe(404);

    // Completa tudo: validações, tarefas e verificações.
    const { groups } = inspectionFindingsSchema.parse(
      (
        await agent.get(
          `/api/v1/collections/${collectionId}/institutions/${ifa.institution.id}/findings`,
        )
      ).body,
    );
    for (const g of groups)
      await agent
        .patch(`/api/v1/findings/${g.problems[0]!.findingId}/validation`)
        .send({ validation: 'confirmed' });
    const { tasks } = portalTasksSchema.parse(
      (
        await agent.get(
          `/api/v1/collections/${collectionId}/institutions/${ifa.institution.id}/tasks`,
        )
      ).body,
    );
    for (const t of tasks) {
      await agent.post('/api/v1/task-inspections').send({
        collectionId,
        institutionId: ifa.institution.id,
        taskId: t.task.id,
        result: 'completed',
        interactions: 3,
        durationSeconds: 40,
        depth: 2,
        path: [],
      });
    }
    for (const page of pages.slice(0, 2)) {
      for (const kind of ['keyboard', 'screen_reader', 'zoom_200', 'captions', 'contrast']) {
        await agent
          .put(`/api/v1/assistive-checks/${page.id}/${kind}`)
          .send({ state: kind === 'captions' ? 'not_applicable' : 'pass' });
      }
    }
    expect((await summary()).sample[0]).toMatchObject({
      findings: { pending: 0 },
      tasks: { done: 2, total: 2 },
      assistive: { done: 2, total: 2 },
      status: 'done',
    });
  });
});
