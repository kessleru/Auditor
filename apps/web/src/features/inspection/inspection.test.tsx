import type { InspectionFindings, InspectionPortal } from '@auditoria-rf/contracts';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '../../test/axe';
import { publicRoutes } from '../../test/fixtures';
import { renderRoute, stubApi } from '../../test/render';

const auditor = { id: 1, email: 'a@iftm.edu.br', name: 'Auditora' };
const portal = (overrides: Partial<InspectionPortal> = {}): InspectionPortal => ({
  institutionId: 1,
  acronym: 'IFTM',
  name: 'Instituto Federal do Triângulo Mineiro',
  domain: 'iftm.edu.br',
  pagesEvaluated: 2,
  findings: { problems: 2, confirmed: 1, falsePositive: 0, pending: 1 },
  tasks: { done: 1, total: 2 },
  assistive: { done: 0, total: 2 },
  status: 'in_progress',
  ...overrides,
});
const summary = (sample: InspectionPortal[], extra = {}) => ({
  collection: { id: 5, finishedAt: '2026-09-12T15:00:00.000Z', status: 'partial' },
  sample,
  candidates: [{ institutionId: 3, acronym: 'IFG', name: 'Instituto Federal de Goiás' }],
  withoutData: [{ institutionId: 4, acronym: 'IFBA' }],
  ...extra,
});
const problem = (id: number, overrides = {}) => ({
  findingId: id,
  fingerprint: `fp${id}`,
  ruleId: 'image-alt',
  title: 'Imagens devem ter texto alternativo',
  description: 'Certifique-se de que elementos <img> tenham texto alternativo',
  helpUrl: 'https://dequeuniversity.com/rules/axe/4.13/image-alt',
  wcagCriteria: '1.1.1',
  principle: 'perceivable',
  severity: 'critical',
  template: false,
  pages: 1,
  occurrences: 1,
  validation: 'pending',
  validationNote: null,
  example: { pageUrl: 'https://iftm.edu.br', selector: 'img', htmlSnippet: '<img src="a.png">' },
  ...overrides,
});
const findings: InspectionFindings = {
  counts: { problems: 2, confirmed: 1, falsePositive: 0, pending: 1 },
  groups: [
    {
      kind: 'template',
      page: null,
      problems: [
        problem(10, { template: true, pages: 2, occurrences: 2, validation: 'confirmed' }),
      ] as never,
    },
    {
      kind: 'page',
      page: { id: 7, url: 'https://iftm.edu.br', functionKey: 'home' },
      problems: [
        problem(11, {
          example: {
            pageUrl: 'https://iftm.edu.br',
            selector: 'main img',
            htmlSnippet: '<img src="b.png">',
          },
        }),
      ] as never,
    },
  ],
};
const base = {
  ...publicRoutes,
  'GET /collections/5/inspection-summary': summary([
    portal(),
    portal({ institutionId: 2, acronym: 'IFSULDEMINAS', status: 'not_started' }),
  ]),
};

describe('portais em inspeção (3.0)', () => {
  it('lista a subamostra e inclui portais avaliados', async () => {
    let body: unknown;
    stubApi(auditor, {
      routes: {
        ...base,
        'PUT /collections/5/inspection-sample': (init: RequestInit | undefined) => {
          body = JSON.parse(String(init?.body));
          return Response.json(summary([portal()]));
        },
      },
    });
    const { container } = renderRoute('/inspecao/5');
    const table = await screen.findByRole('table', { name: 'Portais da subamostra' });
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    expect(
      screen.getByRole('link', { name: 'Continuar inspeção do IFTM' }).getAttribute('href'),
    ).toBe('/inspecao/5/1/validacao');
    expect(screen.getByText(/IFBA não entra na inspeção/)).toBeTruthy();
    await expectNoAxeViolations(container);

    await userEvent.click(screen.getByRole('checkbox', { name: /IFG/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Incluir na subamostra' }));
    await waitFor(() => expect(body).toEqual({ institutionIds: [1, 2, 3] }));
  });
});

describe('portal: contexto, abas e validação (3.3)', () => {
  it('h1 com o nome do portal, abas com contagem e falso positivo com justificativa', async () => {
    let patched: unknown;
    stubApi(auditor, {
      routes: {
        ...base,
        'GET /collections/5/institutions/1/findings': findings,
        'PATCH /findings/11/validation': (init: RequestInit | undefined) => {
          patched = JSON.parse(String(init?.body));
          return Response.json({ finding: {} });
        },
      },
    });
    const { container } = renderRoute('/inspecao/5/1');
    await screen.findByRole('heading', {
      level: 1,
      name: 'Instituto Federal do Triângulo Mineiro (IFTM)',
    });
    expect(document.title).toBe('Validação de achados — IFTM · Auditoria RF');
    // O índice redireciona para a aba de validação (o layout remonta com a nova rota).
    await waitFor(() =>
      expect(
        within(screen.getByRole('navigation', { name: 'Atividades do portal' }))
          .getByRole('link', { name: 'Validação de achados: 1 pendente' })
          .getAttribute('aria-current'),
      ).toBe('page'),
    );
    const tabs = screen.getByRole('navigation', { name: 'Atividades do portal' });
    expect(within(tabs).getByRole('link', { name: 'Tarefas-alvo: 1 de 2' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Próximo portal: IFSULDEMINAS' })).toBeTruthy();

    const sections = await screen.findAllByRole('heading', { level: 2 });
    expect(sections[0]!.textContent).toContain('Em todas as páginas (template)');
    await expectNoAxeViolations(container);

    const toggle = screen.getByRole('button', {
      name: 'Marcar como falso positivo: Imagens devem ter texto alternativo (main img)',
    });
    await userEvent.click(toggle);
    const form = within(document.getElementById(toggle.getAttribute('aria-controls')!)!);
    const register = form.getByRole('button', { name: 'Registrar falso positivo' });
    expect((register as HTMLButtonElement).disabled).toBe(true);
    await userEvent.type(
      form.getByLabelText(/Justificativa/),
      'Imagem decorativa com alt vazio correto.',
    );
    await userEvent.click(register);
    await waitFor(() =>
      expect(patched).toEqual({
        validation: 'false_positive',
        note: 'Imagem decorativa com alt vazio correto.',
      }),
    );
  });
});

describe('tarefas-alvo (3.1)', () => {
  it('interrompida exige heurística, severidade e observação; envia o registro completo', async () => {
    let saved: Record<string, unknown> | undefined;
    stubApi(auditor, {
      routes: {
        ...base,
        'GET /collections/5/institutions/1/tasks': {
          tasks: [
            {
              task: {
                id: 1,
                title: 'Contato institucional',
                description: 'Encontrar um canal de contato.',
                functionKey: 'home',
                active: true,
              },
              inspection: null,
            },
            {
              task: {
                id: 2,
                title: 'Edital do processo seletivo',
                description: 'Encontrar o edital vigente.',
                functionKey: 'admission',
                active: true,
              },
              inspection: null,
            },
          ],
        },
        'POST /task-inspections': (init: RequestInit | undefined) => {
          saved = JSON.parse(String(init?.body));
          return Response.json({ inspection: {} });
        },
      },
    });
    const { container } = renderRoute('/inspecao/5/1/tarefas');
    await screen.findByRole('heading', { level: 2, name: 'Encontrar um canal de contato.' });
    await expectNoAxeViolations(container);

    for (let i = 0; i < 3; i++)
      await userEvent.click(screen.getByRole('button', { name: 'Registrar uma interação' }));
    await userEvent.type(screen.getByLabelText('Próximo passo'), 'Institucional');
    await userEvent.click(screen.getByRole('button', { name: 'Registrar passo' }));
    await userEvent.click(
      screen.getByRole('radio', { name: 'Interrompida — o objetivo não foi alcançado' }),
    );
    const submit = screen.getByRole('button', {
      name: 'Salvar e ir para: Edital do processo seletivo',
    });
    expect((submit as HTMLButtonElement).disabled).toBe(true);

    await userEvent.click(
      screen.getByRole('radio', { name: 'H2 — correspondência com o mundo real' }),
    );
    await userEvent.click(screen.getByRole('radio', { name: 'Moderado' }));
    await userEvent.type(screen.getByLabelText(/Observação do avaliador/), 'Contato só no rodapé.');
    await userEvent.click(submit);
    await waitFor(() =>
      expect(saved).toMatchObject({
        collectionId: 5,
        institutionId: 1,
        taskId: 1,
        result: 'interrupted',
        interactions: 3,
        path: ['Institucional'],
        heuristic: 'H2',
        severity: 'moderate',
        note: 'Contato só no rodapé.',
      }),
    );
  });
});

describe('verificação assistiva (3.2)', () => {
  it('barreira exige severidade e observação', async () => {
    let saved: unknown;
    const checks = ['keyboard', 'screen_reader', 'zoom_200', 'captions', 'contrast'].map(
      (kind) => ({ kind, state: 'pending', severity: null, note: null }),
    );
    stubApi(auditor, {
      routes: {
        ...base,
        'GET /collections/5/institutions/1/assistive-checks': {
          pages: [
            { id: 7, url: 'https://iftm.edu.br', functionKey: 'home', checks },
            { id: 8, url: 'https://iftm.edu.br/ingresso', functionKey: 'admission', checks },
          ],
        },
        'PUT /assistive-checks/7/keyboard': (init: RequestInit | undefined) => {
          saved = JSON.parse(String(init?.body));
          return Response.json({ check: {} });
        },
      },
    });
    const { container } = renderRoute('/inspecao/5/1/verificacao');
    const keyboard = await screen.findByRole('form', { name: 'Navegação apenas por teclado' });
    expect(screen.getByText(/Página 1 de 2, com 0 de 5 verificações/)).toBeTruthy();
    await expectNoAxeViolations(container);

    await userEvent.click(within(keyboard).getByRole('radio', { name: 'Barreira' }));
    const save = within(keyboard).getByRole('button', { name: 'Salvar verificação' });
    expect((save as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(within(keyboard).getByRole('radio', { name: 'Crítico' }));
    await userEvent.type(within(keyboard).getByLabelText(/Observação/), 'Menu não recebe foco.');
    await userEvent.click(save);
    await waitFor(() =>
      expect(saved).toEqual({
        state: 'barrier',
        severity: 'critical',
        note: 'Menu não recebe foco.',
      }),
    );
  });
});
