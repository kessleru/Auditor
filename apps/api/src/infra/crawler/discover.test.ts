import { describe, expect, it } from 'vitest';
import { type FakeResource, fakeSite, fixture, gz, html, links } from './__fixtures__/site.js';
import { DiscoveryError, discoverRoutes } from './discover.js';

const ORIGIN = 'https://www.if.edu.br';
const agent = 'AuditoriaRF';

/** Portal sem sitemap: robots.txt vazio, e a raiz do domínio redireciona para www. */
function crawlerSite(pages: Record<string, FakeResource>) {
  return fakeSite({
    'https://if.edu.br/robots.txt': { redirect: `${ORIGIN}/robots.txt` },
    [`${ORIGIN}/robots.txt`]: { status: 404, body: '', contentType: 'text/plain' },
    ...pages,
  });
}

const run = (client: ReturnType<typeof fakeSite>['client'], opts: { maxUrls?: number } = {}) =>
  discoverRoutes({ domain: 'if.edu.br', client, robotsAgent: agent, ...opts });

const byUrl = (routes: { url: string }[]) => routes.map((r) => r.url).sort();

describe('descoberta por sitemap', () => {
  function sitemapSite() {
    return fakeSite({
      'https://if.edu.br/robots.txt': { redirect: `${ORIGIN}/robots.txt` },
      [`${ORIGIN}/robots.txt`]: { body: fixture('robots.txt'), contentType: 'text/plain' },
      [`${ORIGIN}/`]: { body: html('Início') },
      [`${ORIGIN}/sitemap_index.xml`]: { body: fixture('sitemap_index.xml') },
      [`${ORIGIN}/sitemap-paginas.xml`]: { body: fixture('sitemap-paginas.xml') },
      [`${ORIGIN}/sitemap-noticias.xml.gz`]: { body: gz(fixture('sitemap-noticias.xml')) },
      [`${ORIGIN}/institucional/sobre`]: { body: html('Sobre') },
      [`${ORIGIN}/ensino/biblioteca`]: { body: html('Biblioteca') },
      [`${ORIGIN}/ingresso`]: { body: html('Ingresso') },
      [`${ORIGIN}/restrito/painel`]: { body: html('Painel') },
      [`${ORIGIN}/noticias/1`]: { body: html('Notícia 1') },
      [`${ORIGIN}/noticias/2`]: { body: html('Notícia 2') },
    });
  }

  it('segue o Sitemap do robots.txt, percorre o index e lê sitemap gzip', async () => {
    const site = sitemapSite();
    const result = await run(site.client);

    expect(result.source).toBe('sitemap');
    expect(result.origin).toBe(ORIGIN);
    expect(result.robotsTxtFound).toBe(true);
    expect(result.sitemapFiles).toEqual([
      `${ORIGIN}/sitemap_index.xml`,
      `${ORIGIN}/sitemap-paginas.xml`,
      `${ORIGIN}/sitemap-noticias.xml.gz`,
    ]);
    // Normaliza (utm, espaços), ignora PDF e outra origem.
    expect(byUrl(result.routes)).toEqual([
      ORIGIN,
      `${ORIGIN}/ensino/biblioteca`,
      `${ORIGIN}/ingresso`,
      `${ORIGIN}/institucional/sobre`,
      `${ORIGIN}/noticias/1`,
      `${ORIGIN}/noticias/2`,
      `${ORIGIN}/restrito/painel`,
    ]);
  });

  it('com teto, prioriza URLs que sugerem uma função', async () => {
    const site = sitemapSite();
    const result = await run(site.client, { maxUrls: 3 });

    expect(byUrl(result.routes)).toEqual([
      ORIGIN,
      `${ORIGIN}/ensino/biblioteca`,
      `${ORIGIN}/ingresso`,
    ]);
    expect(site.pageRequests()).not.toContain(`${ORIGIN}/noticias/1`);
  });

  it('sugere funções pela URL e pelo título', async () => {
    const result = await run(sitemapSite().client);
    const fn = Object.fromEntries(result.routes.map((r) => [r.url, r.suggestedFunction]));
    expect(fn[ORIGIN]).toBe('home');
    expect(fn[`${ORIGIN}/ingresso`]).toBe('admission');
    expect(fn[`${ORIGIN}/ensino/biblioteca`]).toBe('library');
    expect(fn[`${ORIGIN}/noticias/1`]).toBeNull();
  });

  it('sem Sitemap no robots.txt, tenta /sitemap.xml', async () => {
    const site = crawlerSite({
      [`${ORIGIN}/`]: { body: html('Início') },
      [`${ORIGIN}/sitemap.xml`]: {
        body: '<urlset><url><loc>https://www.if.edu.br/cursos</loc></url></urlset>',
      },
      [`${ORIGIN}/cursos`]: { body: html('Cursos') },
    });
    const result = await run(site.client);
    expect(result.source).toBe('sitemap');
    expect(result.sitemapFiles).toEqual([`${ORIGIN}/sitemap.xml`]);
    expect(byUrl(result.routes)).toEqual([ORIGIN, `${ORIGIN}/cursos`]);
  });

  it('tenta /sitemap_index.xml e /sitemap.xml.gz quando os anteriores faltam', async () => {
    const site = crawlerSite({
      [`${ORIGIN}/`]: { body: html('Início') },
      [`${ORIGIN}/sitemap.xml.gz`]: {
        body: gz('<urlset><url><loc>https://www.if.edu.br/a</loc></url></urlset>'),
      },
      [`${ORIGIN}/a`]: { body: html('A') },
    });
    const result = await run(site.client);
    expect(site.requested).toEqual(
      expect.arrayContaining([
        `${ORIGIN}/sitemap.xml`,
        `${ORIGIN}/sitemap_index.xml`,
        `${ORIGIN}/sitemap.xml.gz`,
      ]),
    );
    expect(result.sitemapFiles).toEqual([`${ORIGIN}/sitemap.xml.gz`]);
  });
});

describe('descoberta pelo crawler', () => {
  it('usa o crawler quando não há sitemap', async () => {
    const site = crawlerSite({
      [`${ORIGIN}/`]: { body: html('Início', links('/a', '/b')) },
      [`${ORIGIN}/a`]: { body: html('A') },
      [`${ORIGIN}/b`]: { body: html('B') },
    });
    const result = await run(site.client);
    expect(result.source).toBe('crawler');
    expect(result.robotsTxtFound).toBe(false);
    expect(byUrl(result.routes)).toEqual([ORIGIN, `${ORIGIN}/a`, `${ORIGIN}/b`]);
  });

  it('para na profundidade 2', async () => {
    const site = crawlerSite({
      [`${ORIGIN}/`]: { body: html('Início', links('/nivel-1')) },
      [`${ORIGIN}/nivel-1`]: { body: html('N1', links('/nivel-2')) },
      [`${ORIGIN}/nivel-2`]: { body: html('N2', links('/nivel-3')) },
      [`${ORIGIN}/nivel-3`]: { body: html('N3') },
    });
    const result = await run(site.client);
    expect(byUrl(result.routes)).toEqual([ORIGIN, `${ORIGIN}/nivel-1`, `${ORIGIN}/nivel-2`]);
    expect(site.pageRequests()).not.toContain(`${ORIGIN}/nivel-3`);
  });

  it('não passa do teto de URLs (padrão 200)', async () => {
    const many = Array.from({ length: 300 }, (_, i) => `/pagina-${i}`);
    const pages: Record<string, FakeResource> = {
      [`${ORIGIN}/`]: { body: html('Início', links(...many)) },
    };
    for (const path of many) pages[`${ORIGIN}${path}`] = { body: html(path) };
    const site = crawlerSite(pages);

    const result = await run(site.client);
    expect(result.routes).toHaveLength(200);
    expect(new Set(site.pageRequests()).size).toBe(200);
  });

  it('o teto também é configurável', async () => {
    const site = crawlerSite({
      [`${ORIGIN}/`]: { body: html('Início', links('/a', '/b', '/c', '/d')) },
      [`${ORIGIN}/a`]: { body: html('A') },
      [`${ORIGIN}/b`]: { body: html('B') },
      [`${ORIGIN}/c`]: { body: html('C') },
      [`${ORIGIN}/d`]: { body: html('D') },
    });
    const result = await run(site.client, { maxUrls: 3 });
    expect(byUrl(result.routes)).toEqual([ORIGIN, `${ORIGIN}/a`, `${ORIGIN}/b`]);
  });

  it('normaliza e deduplica links; ignora arquivos, outras origens e esquemas não http', async () => {
    const site = crawlerSite({
      [`${ORIGIN}/`]: {
        body: html(
          'Início',
          links(
            '/a',
            '/a/',
            '/a#topo',
            '/a?utm_source=face',
            'https://WWW.IF.EDU.BR/a',
            '/edital.pdf',
            '/foto.jpg',
            'https://campus.if.edu.br/x',
            'https://gov.br',
            'mailto:contato@if.edu.br',
            'javascript:void(0)',
          ),
        ),
      },
      [`${ORIGIN}/a`]: { body: html('A') },
    });
    const result = await run(site.client);
    expect(byUrl(result.routes)).toEqual([ORIGIN, `${ORIGIN}/a`]);
    expect(site.pageRequests().filter((u) => u.endsWith('/a'))).toHaveLength(1);
  });

  it('respeita o robots.txt também para links do crawler', async () => {
    const site = fakeSite({
      'https://if.edu.br/robots.txt': { redirect: `${ORIGIN}/robots.txt` },
      [`${ORIGIN}/robots.txt`]: {
        body: 'User-agent: *\nDisallow: /privado',
        contentType: 'text/plain',
      },
      [`${ORIGIN}/`]: { body: html('Início', links('/privado/x', '/publico')) },
      [`${ORIGIN}/publico`]: { body: html('Público') },
      [`${ORIGIN}/privado/x`]: { body: html('Privado') },
    });
    const result = await run(site.client);
    expect(byUrl(result.routes)).toEqual([ORIGIN, `${ORIGIN}/publico`]);
    expect(result.blockedByRobots).toBe(1);
    expect(site.pageRequests()).not.toContain(`${ORIGIN}/privado/x`);
  });

  it('registra links para homologação como excluídos, com motivo, sem acessá-los', async () => {
    const site = crawlerSite({
      [`${ORIGIN}/`]: { body: html('Início', links('https://hml.if.edu.br/novo-portal')) },
    });
    const result = await run(site.client);
    expect(result.routes).toContainEqual({
      url: 'https://hml.if.edu.br/novo-portal',
      status: 'excluded',
      source: 'crawler',
      suggestedFunction: null,
      relevance: null,
      exclusionReason: 'Domínio de desenvolvimento ou homologação.',
    });
    expect(site.requested).not.toContain('https://hml.if.edu.br/novo-portal');
  });

  it('usa o texto do link para sugerir a função', async () => {
    const site = crawlerSite({
      [`${ORIGIN}/`]: { body: html('Início', links(['/p/42', 'Processo Seletivo'])) },
      [`${ORIGIN}/p/42`]: { body: html('Página 42') },
    });
    const result = await run(site.client);
    expect(result.routes.find((r) => r.url === `${ORIGIN}/p/42`)?.suggestedFunction).toBe(
      'admission',
    );
  });

  it('conta como falha páginas com erro HTTP, sem HTML ou com erro de rede', async () => {
    const site = crawlerSite({
      [`${ORIGIN}/`]: { body: html('Início', links('/404', '/json', '/caiu', '/ok')) },
      [`${ORIGIN}/json`]: { body: '{}', contentType: 'application/json' },
      [`${ORIGIN}/caiu`]: { networkError: true },
      [`${ORIGIN}/ok`]: { body: html('OK') },
    });
    const result = await run(site.client);
    expect(byUrl(result.routes)).toEqual([ORIGIN, `${ORIGIN}/ok`]);
    expect(result.failed).toBe(3);
  });
});

describe('links da página inicial, subdomínios e prioridade', () => {
  it('no modo sitemap, também usa os links da página inicial, com o texto do link', async () => {
    const site = fakeSite({
      [`https://if.edu.br/robots.txt`]: { redirect: `${ORIGIN}/robots.txt` },
      [`${ORIGIN}/robots.txt`]: { status: 404, body: '', contentType: 'text/plain' },
      [`${ORIGIN}/`]: {
        body: html('Início', `<nav>${links(['/p/77', 'Biblioteca'], '/noticias/1')}</nav>`),
      },
      [`${ORIGIN}/sitemap.xml`]: {
        body: '<urlset><url><loc>https://www.if.edu.br/noticias/1</loc></url></urlset>',
      },
      [`${ORIGIN}/p/77`]: { body: html('Página 77') },
      [`${ORIGIN}/noticias/1`]: { body: html('Notícia') },
    });
    const result = await run(site.client);
    expect(result.source).toBe('sitemap');
    const menu = result.routes.find((r) => r.url === `${ORIGIN}/p/77`);
    expect(menu).toMatchObject({
      source: 'crawler',
      suggestedFunction: 'library',
      linkText: 'Biblioteca',
      title: 'Página 77',
    });
    expect(result.routes.find((r) => r.url === `${ORIGIN}/noticias/1`)?.source).toBe('sitemap');
  });

  it('registra subdomínio da instituição que sugere função, sem acessá-lo', async () => {
    const site = crawlerSite({
      [`${ORIGIN}/`]: {
        body: html(
          'Início',
          links(
            ['https://biblioteca.if.edu.br', 'Biblioteca'],
            ['https://suap.if.edu.br/', 'SUAP'],
            ['https://www.campus.if.edu.br/ingresso', 'Veja'],
          ),
        ),
      },
    });
    const result = await run(site.client);
    expect(result.routes.find((r) => r.url === 'https://biblioteca.if.edu.br')).toMatchObject({
      status: 'suggested',
      suggestedFunction: 'library',
      external: true,
    });
    expect(
      result.routes.find((r) => r.url === 'https://www.campus.if.edu.br/ingresso'),
    ).toMatchObject({ suggestedFunction: 'admission', external: true });
    expect(result.routes.some((r) => r.url.includes('suap'))).toBe(false);
    expect(site.requested.some((u) => !u.startsWith(ORIGIN) && !u.includes('robots'))).toBe(false);
  });

  it('aceita links do mesmo site com http:// ou sem www.', async () => {
    const site = crawlerSite({
      [`${ORIGIN}/`]: {
        body: html('Início', links('https://if.edu.br/a', 'http://www.if.edu.br/b')),
      },
      [`${ORIGIN}/a`]: { body: html('A') },
      [`${ORIGIN}/b`]: { body: html('B') },
    });
    const result = await run(site.client);
    expect(byUrl(result.routes)).toEqual([ORIGIN, `${ORIGIN}/a`, `${ORIGIN}/b`]);
  });

  it('ignora busca, feed e impressão, e trata index.php como a própria página', async () => {
    const site = crawlerSite({
      [`${ORIGIN}/`]: {
        body: html('Início', links('/?s=edital', '/feed', '/a/index.php', '/a?print=1', '/a')),
      },
      [`${ORIGIN}/a`]: { body: html('A') },
    });
    const result = await run(site.client);
    expect(byUrl(result.routes)).toEqual([ORIGIN, `${ORIGIN}/a`]);
    expect(site.pageRequests()).toEqual([`${ORIGIN}/`, `${ORIGIN}/a`]);
  });

  it('com teto, o crawler visita antes as páginas que sugerem uma função', async () => {
    const site = crawlerSite({
      [`${ORIGIN}/`]: {
        body: html('Início', links('/a', '/b', ['/c', 'Assistência Estudantil'])),
      },
      [`${ORIGIN}/a`]: { body: html('A') },
      [`${ORIGIN}/b`]: { body: html('B') },
      [`${ORIGIN}/c`]: { body: html('C') },
    });
    const result = await run(site.client, { maxUrls: 2 });
    expect(byUrl(result.routes)).toEqual([ORIGIN, `${ORIGIN}/c`]);
  });

  it('link de menu curto é mais relevante que notícia com o mesmo tema', async () => {
    const news = '/noticias/2026/03/processo-seletivo-2026';
    const site = crawlerSite({
      [`${ORIGIN}/`]: {
        body: html('Início', `<nav>${links(['/ingresso', 'Ingresso'])}</nav>${links(news)}`),
      },
      [`${ORIGIN}/ingresso`]: { body: html('Ingresso') },
      [`${ORIGIN}${news}`]: { body: html('Abertas as inscrições do processo seletivo') },
    });
    const result = await run(site.client);
    const relevance = (path: string) =>
      result.routes.find((r) => r.url === `${ORIGIN}${path}`)?.relevance ?? 0;
    expect(relevance('/ingresso')).toBeGreaterThan(relevance(news));
    expect(result.routes.find((r) => r.url === `${ORIGIN}${news}`)?.suggestedFunction).toBe(
      'admission',
    );
  });

  it('lê página em ISO-8859-1 sem estragar os acentos da sugestão', async () => {
    const site = crawlerSite({
      [`${ORIGIN}/`]: { body: html('Início', links('/p/5')) },
      [`${ORIGIN}/p/5`]: {
        body: Buffer.from(html('Coordenação de Assistência Estudantil'), 'latin1'),
        contentType: 'text/html; charset=iso-8859-1',
      },
    });
    const result = await run(site.client);
    expect(result.routes.find((r) => r.url === `${ORIGIN}/p/5`)).toMatchObject({
      title: 'Coordenação de Assistência Estudantil',
      suggestedFunction: 'student_support',
    });
  });

  it('com o sitemap declarado quebrado, tenta os caminhos padrão', async () => {
    const site = fakeSite({
      [`https://if.edu.br/robots.txt`]: { redirect: `${ORIGIN}/robots.txt` },
      [`${ORIGIN}/robots.txt`]: {
        body: `Sitemap: ${ORIGIN}/nao-existe.xml`,
        contentType: 'text/plain',
      },
      [`${ORIGIN}/`]: { body: html('Início') },
      [`${ORIGIN}/sitemap.xml`]: {
        body: '<urlset><url><loc>https://www.if.edu.br/a</loc></url></urlset>',
      },
      [`${ORIGIN}/a`]: { body: html('A') },
    });
    const result = await run(site.client);
    expect(result.sitemapFiles).toEqual([`${ORIGIN}/sitemap.xml`]);
    expect(result.source).toBe('sitemap');
  });

  it('conta uma vez a URL proibida pelo robots.txt, mesmo linkada várias vezes', async () => {
    const site = fakeSite({
      'https://if.edu.br/robots.txt': { redirect: `${ORIGIN}/robots.txt` },
      [`${ORIGIN}/robots.txt`]: { body: 'User-agent: *\nDisallow: /x', contentType: 'text/plain' },
      [`${ORIGIN}/`]: { body: html('Início', links('/x', '/x/', '/a')) },
      [`${ORIGIN}/a`]: { body: html('A', links('/x')) },
    });
    const result = await run(site.client);
    expect(result.blockedByRobots).toBe(1);
  });
});

describe('limites de tempo e de falhas', () => {
  it('para depois de falhas seguidas demais, sem insistir no portal', async () => {
    const many = Array.from({ length: 30 }, (_, i) => `/p${i}`);
    const pages: Record<string, FakeResource> = {
      [`${ORIGIN}/`]: { body: html('Início', links(...many)) },
    };
    for (const path of many) pages[`${ORIGIN}${path}`] = { status: 403, body: 'bloqueado' };
    const site = crawlerSite(pages);
    const result = await discoverRoutes({
      domain: 'if.edu.br',
      client: site.client,
      robotsAgent: agent,
      maxConsecutiveFailures: 5,
    });
    expect(result.stoppedEarly).toBe('failures');
    expect(site.pageRequests()).toHaveLength(1 + 5);
    expect(byUrl(result.routes)).toEqual([ORIGIN]);
  });

  it('para no tempo máximo, guardando o que já encontrou', async () => {
    let clock = 0;
    const site = crawlerSite({
      [`${ORIGIN}/`]: { body: html('Início', links('/a', '/b', '/c')) },
      [`${ORIGIN}/a`]: { body: html('A') },
      [`${ORIGIN}/b`]: { body: html('B') },
      [`${ORIGIN}/c`]: { body: html('C') },
    });
    const slow = {
      get: async (url: string) => {
        clock += 60_000;
        return site.client.get(url);
      },
    };
    const result = await discoverRoutes({
      domain: 'if.edu.br',
      client: slow,
      robotsAgent: agent,
      // robots, página inicial e 3 tentativas de sitemap = 5 min; sobra tempo para uma visita.
      maxDurationMs: 330_000,
      now: () => clock,
    });
    expect(result.stoppedEarly).toBe('deadline');
    expect(result.routes.length).toBeGreaterThan(1);
    expect(result.routes.length).toBeLessThan(4);
  });

  it('percorrendo tudo, não marca parada antecipada', async () => {
    const site = crawlerSite({ [`${ORIGIN}/`]: { body: html('Início') } });
    expect((await run(site.client)).stoppedEarly).toBeNull();
  });
});

describe('andamento', () => {
  it('informa a etapa e as páginas lidas, com o teto da rodada', async () => {
    const site = fakeSite({
      'https://if.edu.br/robots.txt': { redirect: `${ORIGIN}/robots.txt` },
      [`${ORIGIN}/robots.txt`]: {
        body: `Sitemap: ${ORIGIN}/sitemap.xml`,
        contentType: 'text/plain',
      },
      [`${ORIGIN}/`]: { body: html('Início') },
      [`${ORIGIN}/sitemap.xml`]: {
        body: `<urlset><url><loc>${ORIGIN}/ingresso</loc></url><url><loc>${ORIGIN}/biblioteca</loc></url></urlset>`,
      },
      [`${ORIGIN}/ingresso`]: { body: html('Ingresso') },
      [`${ORIGIN}/biblioteca`]: { body: html('Biblioteca') },
    });
    const events: unknown[] = [];
    await discoverRoutes({
      domain: 'if.edu.br',
      client: site.client,
      robotsAgent: agent,
      checkUrls: [`${ORIGIN}/ingresso`],
      onProgress: (progress) => events.push(progress),
    });

    expect(events[0]).toEqual({ phase: 'robots', visited: 0, planned: null });
    expect(events).toContainEqual({ phase: 'sitemap', visited: 1, planned: null });
    expect(events).toContainEqual({ phase: 'pages', visited: 2, planned: 3 });
    expect(events).toContainEqual({ phase: 'pages', visited: 3, planned: 3 });
    expect(events.at(-1)).toEqual({ phase: 'checks', visited: 3, planned: 3 });
  });

  it('no crawler, o teto é o que está na fila, limitado ao teto de URLs', async () => {
    const site = crawlerSite({
      [`${ORIGIN}/`]: { body: html('Início', links('/a', '/b', '/c')) },
      [`${ORIGIN}/a`]: { body: html('A') },
      [`${ORIGIN}/b`]: { body: html('B') },
      [`${ORIGIN}/c`]: { body: html('C') },
    });
    const lastEvent = async (maxUrls: number) => {
      const events: unknown[] = [];
      await discoverRoutes({
        domain: 'if.edu.br',
        client: site.client,
        robotsAgent: agent,
        maxUrls,
        onProgress: (progress) => events.push(progress),
      });
      return events.at(-1);
    };
    expect(await lastEvent(50)).toEqual({ phase: 'pages', visited: 4, planned: 4 });
    expect(await lastEvent(2)).toEqual({ phase: 'pages', visited: 2, planned: 2 });
  });

  it('um andamento que falha não interrompe a descoberta', async () => {
    const site = crawlerSite({ [`${ORIGIN}/`]: { body: html('Início') } });
    const result = await discoverRoutes({
      domain: 'if.edu.br',
      client: site.client,
      robotsAgent: agent,
      onProgress: () => {
        throw new Error('canal fechado');
      },
    });
    expect(byUrl(result.routes)).toEqual([ORIGIN]);
  });
});

describe('área autenticada', () => {
  it('marca redirecionamento para login e página com senha, sem seguir seus links', async () => {
    const site = crawlerSite({
      [`${ORIGIN}/`]: { body: html('Início', links('/sistema', '/acesso')) },
      [`${ORIGIN}/sistema`]: { redirect: 'https://sso.if.edu.br/login?service=x', status: 302 },
      [`${ORIGIN}/acesso`]: {
        body: html('Acesso', '<input type="password">' + links('/so-logado')),
      },
      [`${ORIGIN}/so-logado`]: { body: html('Interno') },
    });
    const result = await run(site.client);
    const status = Object.fromEntries(result.routes.map((r) => [r.url, r.status]));

    expect(status[`${ORIGIN}/sistema`]).toBe('authenticated');
    expect(status[`${ORIGIN}/acesso`]).toBe('authenticated');
    expect(status[`${ORIGIN}/so-logado`]).toBeUndefined();
    expect(site.pageRequests()).not.toContain(`${ORIGIN}/so-logado`);
  });
});

describe('proteção contra robôs (redirecionamento para fora do domínio)', () => {
  const CHALLENGE = 'https://validate.perfdrive.com/?ssc=portal';

  it('robots.txt redirecionado para outro domínio interrompe a descoberta, sem visitar o desafio', async () => {
    const site = fakeSite({
      'https://if.edu.br/robots.txt': { redirect: CHALLENGE, status: 302 },
      [CHALLENGE]: { body: html('Are you human?') },
      'https://validate.perfdrive.com/': { body: html('Are you human?') },
    });
    await expect(run(site.client)).rejects.toThrow(
      /redirecionou para validate\.perfdrive\.com, fora do domínio da instituição/,
    );
    expect(site.requested).not.toContain('https://validate.perfdrive.com/');
  });

  it('página inicial redirecionada para outro domínio interrompe a descoberta', async () => {
    const site = crawlerSite({ [`${ORIGIN}/`]: { redirect: CHALLENGE, status: 302 } });
    await expect(run(site.client)).rejects.toThrow(/proteção contra robôs/);
  });

  it('páginas que passam a ir para o desafio contam como falha e o domínio fica registrado', async () => {
    const many = Array.from({ length: 12 }, (_, i) => `/p${i}`);
    const pages: Record<string, FakeResource> = {
      [`${ORIGIN}/`]: { body: html('Início', links(...many)) },
    };
    for (const path of many) pages[`${ORIGIN}${path}`] = { redirect: CHALLENGE, status: 302 };
    pages[CHALLENGE] = { body: html('Are you human?') };
    const result = await discoverRoutes({
      domain: 'if.edu.br',
      client: crawlerSite(pages).client,
      robotsAgent: agent,
      maxConsecutiveFailures: 5,
    });
    expect(result.stoppedEarly).toBe('failures');
    expect(result.offDomainHost).toBe('validate.perfdrive.com');
    expect(byUrl(result.routes)).toEqual([ORIGIN]);
  });

  it('sem redirecionamento para fora, não há domínio registrado', async () => {
    const site = crawlerSite({ [`${ORIGIN}/`]: { body: html('Início') } });
    expect((await run(site.client)).offDomainHost).toBeNull();
  });
});

describe('falhas da página inicial', () => {
  it('erro HTTP vira DiscoveryError', async () => {
    const site = crawlerSite({ [`${ORIGIN}/`]: { status: 503, body: 'fora do ar' } });
    await expect(run(site.client)).rejects.toThrow(/HTTP 503/);
  });

  it('robots.txt que proíbe tudo interrompe a descoberta', async () => {
    const site = fakeSite({
      'https://if.edu.br/robots.txt': {
        body: 'User-agent: *\nDisallow: /',
        contentType: 'text/plain',
      },
      'https://if.edu.br/': { body: html('Início') },
    });
    await expect(run(site.client)).rejects.toThrow(/robots\.txt/);
  });

  it('robots.txt com erro de servidor interrompe a descoberta (RFC 9309)', async () => {
    const site = fakeSite({
      'https://if.edu.br/robots.txt': { status: 503, body: 'fora', contentType: 'text/plain' },
      'https://if.edu.br/': { body: html('Início') },
    });
    await expect(run(site.client)).rejects.toThrow(/RFC 9309/);
    expect(site.pageRequests()).toEqual([]);
  });

  it('domínio que não responde sem www. é tentado com www.', async () => {
    const site = fakeSite({
      'https://if.edu.br/robots.txt': { networkError: true },
      'https://if.edu.br/': { networkError: true },
      [`${ORIGIN}/robots.txt`]: { status: 404, body: '', contentType: 'text/plain' },
      [`${ORIGIN}/`]: { body: html('Início', links('/a')) },
      [`${ORIGIN}/a`]: { body: html('A') },
    });
    const result = await run(site.client);
    expect(result.origin).toBe(ORIGIN);
    expect(byUrl(result.routes)).toEqual([ORIGIN, `${ORIGIN}/a`]);
  });

  it('sem resposta com nem sem www., a descoberta falha com o motivo', async () => {
    const site = fakeSite({
      'https://if.edu.br/robots.txt': { networkError: true },
      'https://if.edu.br/': { networkError: true },
      [`${ORIGIN}/robots.txt`]: { networkError: true },
      [`${ORIGIN}/`]: { networkError: true },
    });
    await expect(run(site.client)).rejects.toThrow(/Falha ao acessar https:\/\/www\.if\.edu\.br/);
  });

  it('domínio de homologação é recusado', async () => {
    const site = fakeSite({});
    await expect(
      discoverRoutes({ domain: 'hml.if.edu.br', client: site.client, robotsAgent: agent }),
    ).rejects.toBeInstanceOf(DiscoveryError);
    expect(site.requested).toEqual([]);
  });
});

describe('verificação das rotas confirmadas (3.1.7)', () => {
  it('detecta rota removida, movida permanentemente e intacta', async () => {
    const site = crawlerSite({
      [`${ORIGIN}/`]: { body: html('Início') },
      [`${ORIGIN}/antiga`]: { status: 404, body: 'não encontrada' },
      [`${ORIGIN}/extinta`]: { status: 410, body: 'removida' },
      [`${ORIGIN}/ingresso-2025`]: { redirect: '/ingresso/', status: 301 },
      [`${ORIGIN}/ingresso/`]: { body: html('Ingresso') },
      [`${ORIGIN}/temporaria`]: { redirect: '/ok', status: 302 },
      [`${ORIGIN}/ok`]: { body: html('OK') },
      [`${ORIGIN}/caiu`]: { networkError: true },
    });
    const result = await discoverRoutes({
      domain: 'if.edu.br',
      client: site.client,
      robotsAgent: agent,
      checkUrls: [
        `${ORIGIN}/antiga`,
        `${ORIGIN}/extinta`,
        `${ORIGIN}/ingresso-2025`,
        `${ORIGIN}/temporaria`,
        `${ORIGIN}/ok`,
        `${ORIGIN}/caiu`,
      ],
    });
    expect(result.checks.map((c) => [c.result, c.httpStatus, c.movedTo])).toEqual([
      ['not_found', 404, null],
      ['not_found', 410, null],
      ['moved', 301, `${ORIGIN}/ingresso`],
      ['ok', 200, null],
      ['ok', 200, null],
      ['unreachable', null, null],
    ]);
  });
});
