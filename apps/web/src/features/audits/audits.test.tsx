import type { Institution, Route } from '@auditoria-rf/contracts';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
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
    progress: null,
    queuedAt: null,
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
        'GET /institutions/1/routes': { routes, absences: [] },
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
    const toReview = await screen.findByRole('region', { name: 'Para revisar (2)' });
    const reviewed = screen.getByRole('region', { name: 'Revisadas (1)' });
    expect(screen.getByText('1 de 3 funções revisadas')).toBeTruthy();
    const items = within(toReview).getAllByRole('listitem');
    expect(items.map((i) => within(i).getByRole('heading').textContent?.trim())).toEqual([
      'Ingresso',
      'Biblioteca',
    ]);
    expect(items[0]!.textContent).toContain('Sugestão: iftm.edu.br/ingresso');
    expect(items[1]!.textContent).toContain('A descoberta não sugeriu nenhuma URL.');
    expect(
      within(reviewed).getByRole('heading', { name: 'Página inicial Confirmada' }),
    ).toBeTruthy();
    expect(screen.getByText('Áreas que exigem login (1)')).toBeTruthy();
    await expectNoAxeViolations(container);

    // O resto das opções fica recolhido até o auditor pedir.
    const more = within(items[1]!).getByRole('button', { name: 'Resolver: Biblioteca' });
    expect(more.getAttribute('aria-expanded')).toBe('false');
    await userEvent.click(more);
    expect(more.getAttribute('aria-expanded')).toBe('true');
    expect(within(items[1]!).getByLabelText('Informar a URL')).toBeTruthy();
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
    // A função muda de lista e o botão some: o foco vai para o andamento, não para o topo.
    await waitFor(() => expect(document.activeElement?.textContent).toMatch(/funções revisadas/));
  });

  it('mostra o andamento da descoberta e recarrega as rotas quando ela termina', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let finished = false;
    stubApi(auditor, {
      routes: {
        ...publicRoutes,
        'GET /institutions': { institutions: [inst(1, 'IFTM')] },
        'GET /institutions/1/routes': () =>
          Response.json({ routes: finished ? routes : [], absences: [] }),
        'GET /institutions/1/discovery': () =>
          Response.json({
            discovery: finished
              ? { ...idleDiscovery.discovery, status: 'completed' }
              : {
                  ...idleDiscovery.discovery,
                  status: 'running',
                  progress: { phase: 'pages', visited: 12, planned: 200 },
                },
          }),
      },
    });
    try {
      const { container } = renderRoute(
        '/auditorias/nova/rotas/1?instituicoes=1&funcoes=home,admission',
      );
      expect(await screen.findByText(/12 de até 200 páginas lidas/)).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Descobrindo…' })).toBeTruthy();
      // O leitor de tela ouve só o andamento, sem a frase fixa do intervalo.
      await waitFor(() =>
        expect(container.querySelector('[aria-live="polite"]')?.textContent).toBe(
          'Descobrindo rotas: 12 de até 200 páginas lidas.',
        ),
      );
      await expectNoAxeViolations(container);

      finished = true;
      await vi.advanceTimersByTimeAsync(3000);
      // As rotas gravadas no fim aparecem sem recarregar a página.
      const toReview = await screen.findByRole('region', { name: 'Para revisar (1)' });
      expect(toReview.textContent).toContain('Sugestão: iftm.edu.br/ingresso');
    } finally {
      vi.useRealTimers();
    }
  });

  it('descoberta na fila: avisa que espera vaga e recarrega as rotas quando termina', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let finished = false;
    stubApi(auditor, {
      routes: {
        ...publicRoutes,
        'GET /institutions': { institutions: [inst(1, 'IFTM')] },
        'GET /institutions/1/routes': () =>
          Response.json({ routes: finished ? routes : [], absences: [] }),
        'GET /institutions/1/discovery': () =>
          Response.json({
            discovery: {
              ...idleDiscovery.discovery,
              status: finished ? 'completed' : 'queued',
              queuedAt: '2026-09-28T10:00:00.000Z',
            },
          }),
      },
    });
    try {
      renderRoute('/auditorias/nova/rotas/1?instituicoes=1&funcoes=home,admission');
      expect(await screen.findByText(/Descoberta na fila: começa quando outra/)).toBeTruthy();
      expect(screen.getByText(/dá para sair desta tela/)).toBeTruthy();
      const button = screen.getByRole('button', { name: 'Na fila…' }) as HTMLButtonElement;
      expect(button.disabled).toBe(true);

      finished = true;
      await vi.advanceTimersByTimeAsync(3000);
      expect(await screen.findByRole('region', { name: 'Para revisar (1)' })).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('não anuncia a última descoberta só por abrir a página', async () => {
    stubApi(auditor, {
      routes: {
        ...publicRoutes,
        'GET /institutions': { institutions: [inst(1, 'IFTM')] },
        'GET /institutions/1/routes': { routes, absences: [] },
        'GET /institutions/1/discovery': {
          discovery: {
            ...idleDiscovery.discovery,
            status: 'completed',
            summary: {
              source: 'crawler',
              origin: 'https://iftm.edu.br',
              robotsTxtFound: true,
              sitemapFiles: 0,
              found: 4,
              created: 4,
              authenticated: 1,
              excluded: 0,
              withSuggestion: 2,
              blockedByRobots: 0,
              failed: 0,
              stoppedEarly: 'failures',
              offDomainHost: 'validate.perfdrive.com',
            },
          },
        },
      },
    });
    const { container } = renderRoute('/auditorias/nova/rotas/1?instituicoes=1&funcoes=home');
    const last = await screen.findByText(/Última descoberta: 4 URLs/);
    // Bloqueio por proteção contra robôs é dito como tal, não como portal fora do ar.
    expect(last.textContent).toContain(
      'o portal passou a mandar a ferramenta para validate.perfdrive.com (provável proteção contra robôs)',
    );
    // O anúncio sai por setTimeout: espera além dele antes de conferir o silêncio.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(container.querySelector('[aria-live="polite"]')?.textContent).toBe('');
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
        'GET /institutions/1/routes': { routes: ranked, absences: [] },
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
    const toReview = await screen.findByRole('region', { name: 'Para revisar (2)' });
    const admission = within(toReview).getAllByRole('listitem')[0]!;
    expect(admission.textContent).toContain('iftm.edu.br/ingresso');
    expect(admission.textContent).toContain('Ingresso — IFTM');
    expect(admission.textContent).toContain('Há mais 1 candidata');

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
        'GET /institutions/1/routes': { routes, absences: [] },
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

  it('marca função como não encontrada, com o motivo, e desfaz', async () => {
    let body: unknown;
    let deleted = false;
    const absent = {
      institutionId: 1,
      functionKey: 'library',
      reason: 'Procurei no menu e no mapa do site.',
      decidedAt: '2026-09-24T10:00:00.000Z',
    };
    stubApi(auditor, {
      routes: {
        ...publicRoutes,
        'GET /institutions': { institutions: [inst(1, 'IFTM')] },
        'GET /institutions/1/routes': { routes, absences: [absent] },
        'GET /institutions/1/discovery': idleDiscovery,
        'PUT /institutions/1/functions/class_schedule/absence': (init: RequestInit | undefined) => {
          body = JSON.parse(String(init?.body));
          return Response.json({ absence: { ...absent, functionKey: 'class_schedule' } });
        },
        'DELETE /institutions/1/functions/library/absence': () => {
          deleted = true;
          return new Response(null, { status: 204 });
        },
      },
    });
    const { container } = renderRoute(
      '/auditorias/nova/rotas/1?instituicoes=1&funcoes=library,class_schedule',
    );
    const library = within(await screen.findByRole('region', { name: 'Revisadas (1)' })).getByRole(
      'listitem',
    );
    const schedule = within(screen.getByRole('region', { name: 'Para revisar (1)' })).getByRole(
      'listitem',
    );
    expect(library.textContent).toContain('Não existe no portal');
    expect(library.textContent).toContain('Procurado em: Procurei no menu e no mapa do site.');
    await expectNoAxeViolations(container);

    await userEvent.click(
      within(schedule).getByRole('button', { name: 'Resolver: Horários de aula' }),
    );
    const submit = within(schedule).getByRole('button', { name: 'Registrar que não existe' });
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    await userEvent.type(
      within(schedule).getByLabelText(
        'O portal não tem esta página? Diga onde procurou (ao menos 10 caracteres).',
      ),
      'Menu Ensino e página de cada curso.',
    );
    await userEvent.click(submit);
    await waitFor(() => expect(body).toEqual({ reason: 'Menu Ensino e página de cada curso.' }));

    await userEvent.click(within(library).getByRole('button', { name: 'Alterar: Biblioteca' }));
    await userEvent.click(within(library).getByRole('button', { name: 'Desfazer' }));
    await waitFor(() => expect(deleted).toBe(true));
  });

  it('visão geral conta como revisada a função não encontrada', async () => {
    stubApi(auditor, {
      routes: {
        ...publicRoutes,
        'GET /institutions': { institutions: [inst(1, 'IFTM')] },
        'GET /institutions/1/routes': {
          routes,
          absences: [
            {
              institutionId: 1,
              functionKey: 'admission',
              reason: 'Não há página própria de ingresso.',
              decidedAt: '2026-09-24T10:00:00.000Z',
            },
          ],
        },
      },
    });
    renderRoute('/auditorias/nova/rotas?instituicoes=1&funcoes=home,admission');
    expect(await screen.findByText('2 de 2')).toBeTruthy();
    expect(screen.getByText('1 confirmada, 1 não encontrada')).toBeTruthy();
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: 'Iniciar coleta' }) as HTMLButtonElement).disabled,
      ).toBe(false),
    );
  });

  it('visão geral só libera a coleta com todas as funções confirmadas', async () => {
    stubApi(auditor, {
      routes: {
        ...publicRoutes,
        'GET /institutions': { institutions: [inst(1, 'IFTM')] },
        'GET /institutions/1/routes': { routes, absences: [] },
      },
    });
    renderRoute('/auditorias/nova/rotas?instituicoes=1&funcoes=home,admission');
    expect(await screen.findByText('1 de 2')).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Iniciar coleta' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      screen.getByText('Falta confirmar a rota ou marcar como não encontrada em: IFTM.'),
    ).toBeTruthy();
  });

  it('inicia a coleta e vai para o acompanhamento', async () => {
    const confirmedAll = [routes[0]!, { ...routes[1]!, status: 'confirmed' as const }];
    stubApi(auditor, {
      routes: {
        ...publicRoutes,
        'GET /institutions': { institutions: [inst(1, 'IFTM')] },
        'GET /institutions/1/routes': { routes: confirmedAll, absences: [] },
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
