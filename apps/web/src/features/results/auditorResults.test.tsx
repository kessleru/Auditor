import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '../../test/axe';
import { iftm, problems, publicRoutes } from '../../test/fixtures';
import { renderRoute, stubApi } from '../../test/render';

const auditor = { id: 1, email: 'a@iftm.edu.br', name: 'Auditora' };

beforeEach(() => {
  stubApi(auditor, {
    routes: {
      ...publicRoutes,
      'GET /collections': {
        collections: [
          {
            id: 3,
            status: 'completed',
            scope: { institutionIds: [1], functions: null },
            axeVersion: '4.13.0',
            browserVersion: 'Chromium 153',
            userAgent: 'UA',
            createdBy: 1,
            createdByName: 'Auditora',
            createdAt: '2026-09-12T12:00:00.000Z',
            startedAt: '2026-09-12T12:00:00.000Z',
            finishedAt: '2026-09-12T15:00:00.000Z',
            progress: { total: 4, queued: 0, running: 0, done: 4, failed: 0 },
            institutions: [
              { id: 1, acronym: 'IFTM', name: 'Instituto Federal do Triângulo Mineiro' },
            ],
          },
        ],
      },
      'GET /reports/institutions/1': {
        institution: { ...iftm, inspection: 'in_progress', tasks: { done: 1, total: 2 } },
        history: [{ collectionId: 3, collectedAt: '2026-09-12T15:00:00.000Z', conformity: 0.78 }],
        problems: [...problems, { ...problems[1]!, fingerprint: 'c', validation: 'pending' }],
        manual: {
          tasks: [
            {
              taskTitle: 'Edital de auxílio estudantil',
              taskDescription: 'Encontrar o edital mais recente de auxílio estudantil.',
              result: 'interrupted',
              heuristic: 'H2',
              severity: 'moderate',
              interactions: 9,
              durationSeconds: 252,
              path: ['Início', 'Institucional', 'PRAE'],
              note: 'Edital sob a sigla PRAE.',
            },
          ],
          barriers: [
            {
              pageUrl: 'https://iftm.edu.br',
              kind: 'keyboard',
              severity: 'critical',
              note: 'Menu sem foco.',
            },
          ],
        },
      },
    },
  });
});

describe('painel (4.1)', () => {
  it('mostra os indicadores e a lista de instituições', async () => {
    const { container } = renderRoute('/painel');
    expect(await screen.findByText('1 de 3')).toBeTruthy();
    expect(screen.getByText('1/2')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Abrir relatório do IFTM' }).getAttribute('href')).toBe(
      '/painel/instituicoes/1',
    );
    await expectNoAxeViolations(container);
  });
});

describe('comparativo (4.2)', () => {
  it('ordena, filtra e exporta', async () => {
    const { container } = renderRoute('/comparativo');
    const table = await screen.findByRole('table', { name: 'Comparativo entre instituições' });
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    expect(screen.getByText('1 instituição ainda não avaliada')).toBeTruthy();
    expect(within(table).getByText('Em andamento')).toBeTruthy();
    expect(within(table).getByText('Portal não pôde ser avaliado na coleta')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Exportar CSV' }).getAttribute('href')).toBe(
      '/api/v1/public/export.csv',
    );
    await expectNoAxeViolations(container);

    const onlyInspected = screen.getByRole('button', { name: 'Somente com inspeção manual' });
    await userEvent.click(onlyInspected);
    expect(onlyInspected.getAttribute('aria-pressed')).toBe('true');
    await waitFor(() =>
      expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(2),
    );
    expect(screen.getByText('1 instituição exibida')).toBeTruthy();
  });
});

describe('detalhe do auditor (4.3)', () => {
  it('reúne achados automatizados e da inspeção, com filtros', async () => {
    const { container } = renderRoute('/painel/instituicoes/1');
    await screen.findByRole('heading', {
      level: 1,
      name: 'Instituto Federal do Triângulo Mineiro',
    });
    expect(screen.getByText('1 de 2')).toBeTruthy();
    expect(screen.getAllByRole('article')).toHaveLength(5);
    expect(screen.getByText('Tarefa interrompida: Edital de auxílio estudantil')).toBeTruthy();
    expect(screen.getByText('Barreira: Navegação apenas por teclado')).toBeTruthy();
    await expectNoAxeViolations(container);

    await userEvent.click(screen.getByRole('button', { name: 'Somente inspeção (2)' }));
    expect(screen.getAllByRole('article')).toHaveLength(2);
    await userEvent.click(screen.getByRole('button', { name: 'Somente automatizada (3)' }));
    expect(screen.getAllByRole('article')).toHaveLength(3);
    expect(screen.getByText('Validação pendente')).toBeTruthy();
  });
});
