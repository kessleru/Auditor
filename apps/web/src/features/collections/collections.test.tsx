import type { CollectionPage } from '@auditoria-rf/contracts';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '../../test/axe';
import { FakeEventSource, stubEventSource } from '../../test/eventSource';
import { publicRoutes } from '../../test/fixtures';
import { renderRoute, stubApi } from '../../test/render';

const auditor = { id: 1, email: 'a@iftm.edu.br', name: 'Auditora' };
const page = (id: number, overrides: Partial<CollectionPage> = {}): CollectionPage => ({
  id,
  collectionId: 7,
  routeId: id,
  institutionId: 1,
  url: `https://iftm.edu.br/p${id}`,
  functionKey: 'home',
  status: 'queued',
  httpStatus: null,
  error: null,
  failureKind: null,
  passesCount: 0,
  violationsCount: 0,
  incompleteCount: 0,
  inapplicableCount: 0,
  evaluatedAt: null,
  loadTimeMs: null,
  ...overrides,
});
const collection = (status: string, progress: object) => ({
  id: 7,
  status,
  scope: { institutionIds: [1], functions: null },
  axeVersion: '4.13.0',
  browserVersion: 'Chromium 153',
  userAgent: 'UA',
  createdBy: 1,
  createdAt: '2026-09-22T10:00:00.000Z',
  startedAt: '2026-09-22T13:02:00.000Z',
  finishedAt: null,
  progress: { total: 2, queued: 0, running: 0, done: 0, failed: 0, ...progress },
});
const institutions = [{ id: 1, acronym: 'IFTM', name: 'Instituto Federal do Triângulo Mineiro' }];

let detail: unknown;

beforeEach(() => {
  stubEventSource();
});

function stub(extra: Record<string, unknown> = {}) {
  return stubApi(auditor, {
    routes: { ...publicRoutes, 'GET /collections/7': () => Response.json(detail), ...extra },
  });
}

describe('acompanhamento da coleta (2.1)', () => {
  it('atualiza o progresso pelos eventos do SSE', async () => {
    detail = {
      collection: collection('running', { queued: 2 }),
      institutions,
      pages: [page(1), page(2)],
    };
    stub();
    const { container } = renderRoute('/coletas/7');
    await screen.findByRole('heading', { level: 1, name: 'Auditoria em execução' });
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0');
    expect(screen.getByText('Na fila')).toBeTruthy();
    await expectNoAxeViolations(container);

    const source = FakeEventSource.instances.at(-1)!;
    expect(source.url).toBe('/api/v1/collections/7/events');
    expect(source.init).toEqual({ withCredentials: true });

    act(() =>
      source.emit('page-started', {
        type: 'page-started',
        pageId: 1,
        progress: collection('running', { queued: 1, running: 1 }).progress,
      }),
    );
    expect(await screen.findByText('Em análise')).toBeTruthy();

    act(() =>
      source.emit('page-done', {
        type: 'page-done',
        page: page(1, { status: 'done', violationsCount: 3, passesCount: 20 }),
        progress: collection('running', { queued: 1, done: 1 }).progress,
      }),
    );
    await waitFor(() =>
      expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('50'),
    );
    expect(screen.getByText('1 de 2 páginas')).toBeTruthy();
  });

  it('depois de 3 falhas do SSE, passa a consultar a cada 5 s', async () => {
    detail = {
      collection: collection('running', { queued: 2 }),
      institutions,
      pages: [page(1), page(2)],
    };
    stub();
    renderRoute('/coletas/7');
    await screen.findByRole('heading', { level: 1, name: 'Auditoria em execução' });
    const source = FakeEventSource.instances.at(-1)!;
    act(() => {
      source.fail();
      source.fail();
    });
    expect(source.closed).toBe(false);
    act(() => source.fail());
    expect(source.closed).toBe(true);
    expect(await screen.findByText(/Atualizando a cada 5 segundos/)).toBeTruthy();
  });

  it('SSE recusado pelo servidor (ex.: 502 do proxy) passa logo a consultar a cada 5 s', async () => {
    detail = {
      collection: collection('running', { queued: 2 }),
      institutions,
      pages: [page(1), page(2)],
    };
    stub();
    renderRoute('/coletas/7');
    await screen.findByRole('heading', { level: 1, name: 'Auditoria em execução' });
    const source = FakeEventSource.instances.at(-1)!;
    // O navegador não reconecta depois de uma resposta de erro: esperar 3 falhas travaria a tela.
    act(() => source.failPermanently());
    expect(source.closed).toBe(true);
    expect(await screen.findByText(/Atualizando a cada 5 segundos/)).toBeTruthy();
  });

  it('cancelamento pede confirmação', async () => {
    detail = {
      collection: collection('running', { queued: 2 }),
      institutions,
      pages: [page(1), page(2)],
    };
    let cancelled = false;
    stub({
      'POST /collections/7/cancel': () => {
        cancelled = true;
        return Response.json({ collection: collection('cancelled', { queued: 2 }) });
      },
    });
    renderRoute('/coletas/7');
    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar auditoria' }));
    expect(cancelled).toBe(false);
    const group = screen.getByRole('group', { name: 'Confirmar cancelamento' });
    await userEvent.click(within(group).getByRole('button', { name: 'Confirmar cancelamento' }));
    await waitFor(() => expect(cancelled).toBe(true));
  });
});

describe('falha parcial (2.2)', () => {
  it('lista as falhas com motivo legível e permite tentar de novo', async () => {
    detail = {
      collection: {
        ...collection('partial', { done: 1, failed: 1 }),
        finishedAt: '2026-09-22T13:20:00.000Z',
      },
      institutions,
      pages: [
        page(1, { status: 'done', violationsCount: 2, loadTimeMs: 2345 }),
        page(2, {
          status: 'failed',
          error: 'page.goto: Timeout 30000ms exceeded.',
          failureKind: 'timeout',
        }),
      ],
    };
    let retried = false;
    stub({
      'POST /collection-pages/2/retry': () => {
        retried = true;
        return Response.json({ page: page(2) });
      },
    });
    const { container } = renderRoute('/coletas/7');
    expect(
      await screen.findByRole('heading', { name: '1 página não pôde ser auditada' }),
    ).toBeTruthy();
    expect(screen.getByText('Tempo de resposta esgotado após 30 segundos')).toBeTruthy();
    expect(screen.getByText(/ausência de dado, não como conformidade zero/)).toBeTruthy();
    // Confiabilidade: tempo de carregamento e falhas por motivo.
    const reliability = screen.getByRole('region', { name: 'Confiabilidade da coleta' });
    expect(reliability.textContent).toContain('mediana 2,3 s · máximo 2,3 s (1 página medida)');
    expect(reliability.textContent).toContain('Tempo esgotado: 1 página');
    await expectNoAxeViolations(container);
    await userEvent.click(
      screen.getByRole('button', { name: 'Tentar novamente https://iftm.edu.br/p2' }),
    );
    await waitFor(() => expect(retried).toBe(true));
    // Coleta terminada não abre SSE.
    expect(FakeEventSource.instances).toHaveLength(0);
  });
});

describe('histórico de coletas', () => {
  it('mostra quem criou cada coleta', async () => {
    stub({
      'GET /collections': {
        collections: [
          {
            ...collection('completed', { done: 2 }),
            finishedAt: '2026-09-22T13:20:00.000Z',
            createdBy: 9,
            createdByName: 'Demonstração (coleta de exemplo)',
            institutions,
          },
        ],
      },
    });
    const { container } = renderRoute('/historico');
    const table = await screen.findByRole('table', { name: 'Histórico de coletas' });
    expect(within(table).getByRole('columnheader', { name: 'Autor' })).toBeTruthy();
    expect(within(table).getByText('Demonstração (coleta de exemplo)')).toBeTruthy();
    await expectNoAxeViolations(container);
  });
});

describe('painel vazio (5.1)', () => {
  it('convida a iniciar a primeira auditoria', async () => {
    stubApi(auditor, { routes: publicRoutes });
    const { container } = renderRoute('/painel');
    expect(
      await screen.findByRole('heading', { name: 'Nenhuma coleta realizada ainda' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Iniciar primeira auditoria' }).getAttribute('href'),
    ).toBe('/auditorias/nova');
    await expectNoAxeViolations(container);
  });
});
