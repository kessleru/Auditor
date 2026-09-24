import type { Institution, Route } from '@auditoria-rf/contracts';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '../../test/axe';
import { publicRoutes } from '../../test/fixtures';
import { renderRoute, stubApi } from '../../test/render';

const auditor = { id: 1, email: 'a@iftm.edu.br', name: 'Auditora' };
const inst = (id: number, acronym: string): Institution => ({
  id,
  name: `Instituto ${acronym}`,
  acronym,
  domain: `${acronym.toLowerCase()}.edu.br`,
  active: true,
  createdAt: '2026-09-01T00:00:00.000Z',
});
const route = (id: number, path: string, overrides: Partial<Route> = {}): Route => ({
  id,
  institutionId: 1,
  url: `https://iftm.edu.br${path}`,
  normalizedUrl: `https://iftm.edu.br${path}`,
  functionKey: null,
  source: 'sitemap',
  status: 'suggested',
  exclusionReason: null,
  replacedByRouteId: null,
  discoveredAt: '2026-09-01T00:00:00.000Z',
  confirmedAt: null,
  lastSeenAt: null,
  title: null,
  linkText: null,
  relevance: null,
  ...overrides,
});
const idleDiscovery = {
  discovery: {
    institutionId: 1,
    status: 'idle',
    startedAt: null,
    finishedAt: null,
    error: null,
    summary: null,
    replacements: [],
  },
};

describe('nova auditoria (1.1)', () => {
  it('valida o escopo e segue para a revisão com o escopo na URL', async () => {
    stubApi(auditor, {
      routes: {
        ...publicRoutes,
        'GET /institutions': { institutions: [inst(1, 'IFTM'), inst(2, 'IFG')] },
      },
    });
    const { router, container } = renderRoute('/auditorias/nova');
    await screen.findByRole('radio', { name: 'Todas as instituições ativas — 2 portais' });
    await expectNoAxeViolations(container);

    await userEvent.click(screen.getByRole('radio', { name: 'Escolher instituições' }));
    for (const box of screen.getAllByRole('checkbox', { checked: true }))
      await userEvent.click(box);
    await userEvent.click(
      screen.getByRole('button', { name: 'Continuar para a revisão de rotas' }),
    );
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Escolha ao menos uma instituição.');
    expect(alert.textContent).toContain('Escolha ao menos uma página por instituição.');

    await userEvent.click(screen.getByRole('checkbox', { name: /IFG/ }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Biblioteca' }));
    await userEvent.click(
      screen.getByRole('button', { name: 'Continuar para a revisão de rotas' }),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe('/auditorias/nova/rotas'));
    expect(router.state.location.search).toBe('?instituicoes=2&funcoes=library');
  });
});

describe('revisão de rotas (1.2)', () => {
  const routes = [
    route(1, '', {
      functionKey: 'home',
      status: 'confirmed',
      confirmedAt: '2026-09-02T00:00:00.000Z',
    }),
    route(2, '/ingresso', { functionKey: 'admission', source: 'crawler' }),
    route(3, '/noticias'),
    route(4, '/suap', { status: 'authenticated' }),
  ];

  it('mostra uma linha por função e confirma a sugestão como troca atômica', async () => {
    let patched: unknown;
    stubApi(auditor, {
      routes: {
        ...publicRoutes,
        'GET /institutions': { institutions: [inst(1, 'IFTM')] },
        'GET /institutions/1/routes': { routes },
        'GET /institutions/1/discovery': idleDiscovery,
        'PATCH /routes/2': (init: RequestInit | undefined) => {
          patched = JSON.parse(String(init?.body));
          return Response.json({ route: { ...routes[1], status: 'confirmed' } });
        },
      },
    });
    const { container } = renderRoute(
      '/auditorias/nova/rotas/1?instituicoes=1&funcoes=home,admission,library',
    );
    const table = await screen.findByRole('table', { name: 'Rotas por função avaliada — IFTM' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map((r) => within(r).getByRole('rowheader').textContent)).toEqual([
      'Página inicial',
      'Ingresso',
      'Biblioteca',
    ]);
    expect(rows[0]!.textContent).toContain('Confirmada');
    expect(rows[1]!.textContent).toContain('Revisar sugestão');
    expect(rows[1]!.textContent).toContain('rastreamento');
    expect(rows[2]!.textContent).toContain('Nenhuma URL sugerida');
    expect(screen.getByText('Áreas que exigem autenticação (1)')).toBeTruthy();
    await expectNoAxeViolations(container);

    await userEvent.click(
      screen.getByRole('button', { name: 'Confirmar iftm.edu.br/ingresso para Ingresso' }),
    );
    await waitFor(() =>
      expect(patched).toEqual({
        status: 'confirmed',
        functionKey: 'admission',
        replaceConfirmed: true,
      }),
    );
  });

  it('sugere a candidata mais relevante e lista todas as URLs com filtro', async () => {
    let patched: unknown;
    const ranked = [
      route(1, '', { functionKey: 'home', status: 'confirmed', relevance: 100 }),
      route(5, '/noticias/2026/03/inscricoes-processo-seletivo', {
        functionKey: 'admission',
        relevance: 30,
        title: 'Inscrições abertas',
      }),
      route(6, '/ingresso', {
        functionKey: 'admission',
        relevance: 95,
        title: 'Ingresso — IFTM',
        source: 'crawler',
      }),
      route(7, '/bibliotecas', { functionKey: 'library', relevance: 80, linkText: 'Biblioteca' }),
      route(8, '/institucional'),
    ];
    stubApi(auditor, {
      routes: {
        ...publicRoutes,
        'GET /institutions': { institutions: [inst(1, 'IFTM')] },
        'GET /institutions/1/routes': { routes: ranked },
        'GET /institutions/1/discovery': idleDiscovery,
        'PATCH /routes/7': (init: RequestInit | undefined) => {
          patched = JSON.parse(String(init?.body));
          return Response.json({ route: { ...ranked[3], status: 'confirmed' } });
        },
      },
    });
    const { container } = renderRoute(
      '/auditorias/nova/rotas/1?instituicoes=1&funcoes=home,admission,library',
    );
    const table = await screen.findByRole('table', { name: 'Rotas por função avaliada — IFTM' });
    const admission = within(table).getAllByRole('row')[2]!;
    expect(admission.textContent).toContain('iftm.edu.br/ingresso');
    expect(admission.textContent).toContain('Ingresso — IFTM');
    expect(admission.textContent).toContain('Mais 1 candidata');

    await userEvent.click(screen.getByText('Todas as URLs descobertas (5)'));
    const list = screen.getByRole('table', { name: 'URLs descobertas, por relevância' });
    const urls = within(list)
      .getAllByRole('rowheader')
      .map((cell) => cell.querySelector('a')?.textContent);
    expect(urls).toEqual([
      'iftm.edu.br',
      'iftm.edu.br/ingresso',
      'iftm.edu.br/bibliotecas',
      'iftm.edu.br/noticias/2026/03/inscricoes-processo-seletivo',
      'iftm.edu.br/institucional',
    ]);
    expect(within(list).getByText('Alta (95)')).toBeTruthy();
    await expectNoAxeViolations(container);

    await userEvent.type(
      screen.getByRole('searchbox', { name: 'Filtrar por endereço, título ou texto do link' }),
      'biblioteca',
    );
    expect(screen.getByText('1 de 5 URLs')).toBeTruthy();
    await userEvent.click(
      screen.getByRole('button', { name: 'Usar iftm.edu.br/bibliotecas como Biblioteca' }),
    );
    await waitFor(() =>
      expect(patched).toEqual({
        status: 'confirmed',
        functionKey: 'library',
        replaceConfirmed: true,
      }),
    );
  });

  it('propõe substituição e só troca quando o auditor confirma', async () => {
    let replaced: unknown;
    stubApi(auditor, {
      routes: {
        ...publicRoutes,
        'GET /institutions': { institutions: [inst(1, 'IFTM')] },
        'GET /institutions/1/routes': { routes },
        'GET /institutions/1/discovery': {
          discovery: {
            ...idleDiscovery.discovery,
            status: 'completed',
            replacements: [
              {
                routeId: 1,
                url: 'https://iftm.edu.br',
                functionKey: 'home',
                reason: 'moved',
                httpStatus: 301,
                candidateRouteId: 3,
                candidateUrl: 'https://iftm.edu.br/noticias',
              },
            ],
          },
        },
        'POST /routes/1/replace': (init: RequestInit | undefined) => {
          replaced = JSON.parse(String(init?.body));
          return Response.json({ route: {}, replaced: {} });
        },
      },
    });
    renderRoute('/auditorias/nova/rotas/1?instituicoes=1&funcoes=home');
    expect(
      await screen.findByRole('heading', { name: 'Possíveis substituições de rota' }),
    ).toBeTruthy();
    expect(screen.getByText(/mudou de endereço \(HTTP 301\)/)).toBeTruthy();
    await userEvent.click(
      screen.getByRole('button', {
        name: 'Confirmar substituição de iftm.edu.br por iftm.edu.br/noticias',
      }),
    );
    await waitFor(() => expect(replaced).toEqual({ newRouteId: 3 }));
  });

  it('visão geral só libera a coleta com todas as funções confirmadas', async () => {
    stubApi(auditor, {
      routes: {
        ...publicRoutes,
        'GET /institutions': { institutions: [inst(1, 'IFTM')] },
        'GET /institutions/1/routes': { routes },
      },
    });
    renderRoute('/auditorias/nova/rotas?instituicoes=1&funcoes=home,admission');
    expect(await screen.findByText('1 de 2')).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Iniciar coleta' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(screen.getByText('Falta confirmar rotas em: IFTM.')).toBeTruthy();
  });

  it('inicia a coleta e vai para o acompanhamento', async () => {
    const confirmedAll = [routes[0]!, { ...routes[1]!, status: 'confirmed' as const }];
    stubApi(auditor, {
      routes: {
        ...publicRoutes,
        'GET /institutions': { institutions: [inst(1, 'IFTM')] },
        'GET /institutions/1/routes': { routes: confirmedAll },
        'POST /collections': {
          collection: {
            id: 9,
            status: 'queued',
            scope: { institutionIds: [1], functions: ['home', 'admission'] },
            axeVersion: null,
            browserVersion: null,
            userAgent: null,
            createdBy: 1,
            createdAt: '2026-09-22T10:00:00.000Z',
            startedAt: null,
            finishedAt: null,
            progress: { total: 2, queued: 2, running: 0, done: 0, failed: 0 },
          },
        },
      },
    });
    const { router } = renderRoute('/auditorias/nova/rotas?instituicoes=1&funcoes=home,admission');
    const start = await screen.findByRole('button', { name: 'Iniciar coleta' });
    await waitFor(() => expect((start as HTMLButtonElement).disabled).toBe(false));
    await userEvent.click(start);
    await waitFor(() => expect(router.state.location.pathname).toBe('/coletas/9'));
  });
});
