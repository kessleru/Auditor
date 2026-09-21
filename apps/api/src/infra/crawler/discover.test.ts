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
      suggestedFunction: null,
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

  it('domínio de homologação é recusado', async () => {
    const site = fakeSite({});
    await expect(
      discoverRoutes({ domain: 'hml.if.edu.br', client: site.client, robotsAgent: agent }),
    ).rejects.toBeInstanceOf(DiscoveryError);
    expect(site.requested).toEqual([]);
  });
});
