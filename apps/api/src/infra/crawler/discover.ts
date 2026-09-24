import type { PageFunctionKey, RouteSource } from '@auditoria-rf/contracts';
import { isAuthenticatedArea, isAuthUrl } from './auth-detection.js';
import { decodeHtml, type PageLink, parseHtml } from './html.js';
import { FetchFailedError, type HttpClient, type HttpResponse } from './http.js';
import { parseRobots, type RobotsRules } from './robots.js';
import { decodeSitemapBody, parseSitemap } from './sitemap.js';
import { suggestionRelevance } from './suggest-function.js';
import {
  DEV_HOST_REASON,
  isCrawlTrap,
  isDevHost,
  isNavigable,
  isSameOrigin,
  isWithinDomain,
  normalizeUrl,
  toCanonicalOrigin,
} from './url.js';

// Descoberta de rotas de um portal (seção 3.1 do plano): robots.txt → sitemap → crawler.

export const DEFAULT_MAX_URLS = 200;
export const DEFAULT_MAX_DEPTH = 2;
const FALLBACK_SITEMAPS = ['/sitemap.xml', '/sitemap_index.xml', '/sitemap.xml.gz'];
const MAX_SITEMAP_FILES = 50;
const MAX_SITEMAP_INDEX_DEPTH = 2;
const MAX_CRAWL_DELAY_MS = 30_000;

export interface DiscoveredRoute {
  url: string;
  status: 'suggested' | 'authenticated' | 'excluded';
  /** `sitemap` se a URL veio do sitemap; `crawler` se veio de um link de página. */
  source: Extract<RouteSource, 'sitemap' | 'crawler'>;
  suggestedFunction: PageFunctionKey | null;
  /** Relevância da sugestão, 0–100 (`suggestionRelevance`); `null` sem sugestão. */
  relevance: number | null;
  exclusionReason?: string;
  title?: string;
  /** Texto do link que levou à página, quando houver. */
  linkText?: string;
  /** Subdomínio da instituição linkado pelo portal: registrado como sugestão, sem ser acessado. */
  external?: boolean;
}

export interface DiscoveryResult {
  origin: string;
  /** Como a descoberta percorreu o portal: sitemap (com os links da página inicial) ou crawler. */
  source: Extract<RouteSource, 'sitemap' | 'crawler'>;
  robotsTxtFound: boolean;
  sitemapFiles: string[];
  routes: DiscoveredRoute[];
  /** URLs distintas não visitadas porque o robots.txt proíbe. */
  blockedByRobots: number;
  /** URLs que falharam, deram erro HTTP ou não eram HTML. */
  failed: number;
  /** Verificação das rotas já confirmadas (seção 3.1.7). */
  checks: RouteCheck[];
}

/**
 * Situação de uma rota confirmada: `ok`, `not_found` (404/410) ou `moved` (redirecionamento
 * permanente 301/308 para `movedTo`). Falha de rede não é conclusiva e vira `unreachable`.
 */
export interface RouteCheck {
  url: string;
  result: 'ok' | 'not_found' | 'moved' | 'unreachable';
  httpStatus: number | null;
  movedTo: string | null;
}

export interface DiscoveryOptions {
  domain: string;
  client: HttpClient;
  /** Nome do robô usado para casar as regras do robots.txt. */
  robotsAgent: string;
  maxUrls?: number;
  maxDepth?: number;
  /** Rotas confirmadas a verificar (possível substituição, seção 3.1.7). */
  checkUrls?: string[];
}

export class DiscoveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DiscoveryError';
  }
}

type PageOutcome =
  | { kind: 'page'; url: string; title: string | undefined; html: string }
  | { kind: 'authenticated'; url: string; title: string | undefined }
  | { kind: 'skipped' };

/** O que se sabe de uma URL pelos links que apontam para ela. */
interface LinkInfo {
  text: string | undefined;
  inNav: boolean;
  depth: number;
}

export async function discoverRoutes({
  domain,
  client,
  robotsAgent,
  maxUrls = DEFAULT_MAX_URLS,
  maxDepth = DEFAULT_MAX_DEPTH,
  checkUrls = [],
}: DiscoveryOptions): Promise<DiscoveryResult> {
  if (isDevHost(domain)) throw new DiscoveryError(DEV_HOST_REASON);

  // robots.txt antes de qualquer página; o redirecionamento dele já revela a origem canônica.
  let { robots, robotsTxtFound, origin } = await loadRobots(
    client,
    `https://${domain}`,
    robotsAgent,
  );
  let intervalMs = crawlInterval(robots);

  let homeResponse: HttpResponse;
  try {
    homeResponse = await client.get(`${origin}/`, { intervalMs });
  } catch (err) {
    throw new DiscoveryError(err instanceof Error ? err.message : String(err));
  }
  if (homeResponse.status >= 400) {
    throw new DiscoveryError(`A página inicial respondeu HTTP ${homeResponse.status}.`);
  }
  const homeOrigin = new URL(homeResponse.url).origin;
  if (isDevHost(new URL(homeOrigin).host)) throw new DiscoveryError(DEV_HOST_REASON);
  if (homeOrigin !== origin) {
    ({ robots, robotsTxtFound, origin } = await loadRobots(client, homeOrigin, robotsAgent));
    intervalMs = crawlInterval(robots);
  }
  const homeUrl = normalizeUrl(homeResponse.url) as string;
  if (!robots.isAllowed(homeUrl)) {
    throw new DiscoveryError(
      'O robots.txt do portal proíbe o acesso da ferramenta à página inicial.',
    );
  }

  const state = {
    routes: new Map<string, DiscoveredRoute>(),
    blockedByRobots: new Set<string>(),
    failed: 0,
  };
  const linkInfo = new Map<string, LinkInfo>();
  const inSitemap = new Set<string>();

  const addExcluded = (url: string, reason: string) => {
    if (!state.routes.has(url)) {
      state.routes.set(url, {
        url,
        status: 'excluded',
        source: 'crawler',
        suggestedFunction: null,
        relevance: null,
        exclusionReason: reason,
      });
    }
  };

  /**
   * Link para outro subdomínio da instituição (ex.: `biblioteca.if.edu.br`): fica fora do
   * rastreamento (seção 3.1.3), mas, se o link sugere uma das funções, entra como sugestão sem ser
   * acessado, para o auditor decidir. Portais costumam ter biblioteca e processo seletivo assim.
   */
  const addSubdomain = (url: string, link: PageLink, depth: number) => {
    if (state.routes.has(url) || !isNavigable(url) || isCrawlTrap(url)) return;
    const { functionKey, relevance } = suggestionRelevance({
      url,
      linkText: link.text,
      inNav: link.inNav,
      depth,
      includeHost: true,
    });
    if (functionKey === null || functionKey === 'home') return;
    state.routes.set(url, {
      url,
      status: 'suggested',
      source: 'crawler',
      suggestedFunction: functionKey,
      relevance: Math.max(0, (relevance ?? 0) - 10),
      ...(link.text && { linkText: link.text }),
      external: true,
    });
  };

  const noteLink = (url: string, link: PageLink | undefined, depth: number) => {
    const known = linkInfo.get(url);
    const text = known?.text ?? (link?.text || undefined);
    linkInfo.set(url, {
      text,
      inNav: (known?.inNav ?? false) || (link?.inNav ?? false),
      depth: Math.min(known?.depth ?? depth, depth),
    });
  };

  /**
   * Classifica uma URL encontrada (link de página ou entrada de sitemap): candidata a visita,
   * excluída (homologação), sugestão de subdomínio ou ignorada.
   */
  const screen = (raw: string, base: string, depth: number, link?: PageLink): string | null => {
    const normalized = normalizeUrl(raw, base);
    if (!normalized) return null;
    const url = toCanonicalOrigin(normalized, origin);
    if (!isSameOrigin(url, origin)) {
      const { host } = new URL(url);
      if (!isWithinDomain(host, domain)) return null;
      if (isDevHost(host)) addExcluded(url, DEV_HOST_REASON);
      else if (link) addSubdomain(url, link, depth);
      return null;
    }
    if (!isNavigable(url) || isCrawlTrap(url)) return null;
    if (!robots.isAllowed(url)) {
      state.blockedByRobots.add(url);
      return null;
    }
    if (link) noteLink(url, link, depth);
    return url;
  };

  const linksOf = (html: string, pageUrl: string, depth: number): string[] => {
    const page = parseHtml(html);
    const base = page.baseHref ? (normalizeUrl(page.baseHref, pageUrl) ?? pageUrl) : pageUrl;
    const found: string[] = [];
    for (const link of page.links) {
      const url = screen(link.href, base, depth, link);
      if (url) found.push(url);
    }
    return [...new Set(found)];
  };

  /** Relevância pelo que se sabe antes de visitar (URL e links): decide a ordem das visitas. */
  const priority = (url: string) => {
    const info = linkInfo.get(url);
    return (
      suggestionRelevance({
        url,
        linkText: info?.text,
        inNav: info?.inNav ?? false,
        depth: info?.depth ?? DEFAULT_MAX_DEPTH,
      }).relevance ?? -1
    );
  };

  const record = (outcome: PageOutcome) => {
    if (outcome.kind === 'skipped') {
      state.failed++;
      return;
    }
    if (state.routes.has(outcome.url)) return;
    const info = linkInfo.get(outcome.url);
    const { functionKey, relevance } = suggestionRelevance({
      url: outcome.url,
      title: outcome.title,
      linkText: info?.text,
      inNav: info?.inNav ?? false,
      depth: outcome.url === homeUrl ? 0 : (info?.depth ?? DEFAULT_MAX_DEPTH),
    });
    state.routes.set(outcome.url, {
      url: outcome.url,
      status: outcome.kind === 'authenticated' ? 'authenticated' : 'suggested',
      source: inSitemap.has(outcome.url) ? 'sitemap' : 'crawler',
      suggestedFunction: functionKey,
      relevance,
      ...(outcome.title !== undefined && { title: outcome.title }),
      ...(info?.text && { linkText: info.text }),
    });
  };

  const visit = async (url: string): Promise<PageOutcome> => {
    try {
      return analyzePage(await client.get(url, { intervalMs }), origin);
    } catch (err) {
      if (err instanceof FetchFailedError) return { kind: 'skipped' };
      throw err;
    }
  };

  const homeOutcome = analyzePage(homeResponse, origin);
  if (homeOutcome.kind !== 'page') {
    throw new DiscoveryError('A página inicial não pôde ser lida como HTML público.');
  }
  record(homeOutcome);
  // Os links da página inicial (menus, atalhos) são o melhor indício das páginas de cada função.
  const homeLinks = linksOf(homeOutcome.html, homeUrl, 1).filter((u) => u !== homeUrl);

  // 1) Sitemap: declarado no robots.txt ou em um dos caminhos padrão.
  const sitemap = await collectSitemapUrls(client, origin, domain, robots, intervalMs);
  const sitemapCandidates = [
    ...new Set(sitemap.urls.map((u) => screen(u, origin, DEFAULT_MAX_DEPTH))),
  ].filter((u): u is string => u !== null && u !== homeUrl);
  for (const url of sitemapCandidates) inSitemap.add(url);

  let source: DiscoveryResult['source'];
  if (sitemapCandidates.length > 0) {
    source = 'sitemap';
    // Teto: primeiro as URLs mais relevantes para alguma função, depois as demais — links da
    // página inicial antes, e o restante na ordem do sitemap.
    const candidates = [...new Set([...homeLinks, ...sitemapCandidates])];
    const ranked = candidates
      .map((url, index) => ({ url, index, score: priority(url) }))
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .slice(0, maxUrls - 1);
    for (const { url } of ranked) record(await visit(url));
  } else {
    // 2) Sem sitemap: crawler em largura a partir da página inicial. Dentro de cada nível, as
    // URLs mais relevantes primeiro, para o teto não cortar justamente as páginas das funções.
    source = 'crawler';
    const seen = new Set([homeUrl, ...homeLinks]);
    const queue: { url: string; depth: number }[] = homeLinks.map((url) => ({ url, depth: 1 }));
    let visits = 1;

    const next = () => {
      const depth = (queue[0] as (typeof queue)[number]).depth;
      let best = 0;
      let bestScore = priority(queue[0]!.url);
      for (let i = 1; i < queue.length && queue[i]!.depth === depth; i++) {
        const score = priority(queue[i]!.url);
        if (score > bestScore) [best, bestScore] = [i, score];
      }
      return queue.splice(best, 1)[0] as (typeof queue)[number];
    };

    while (queue.length > 0 && visits < maxUrls) {
      const item = next();
      visits++;
      const outcome = await visit(item.url);
      record(outcome);
      if (outcome.kind === 'page') {
        seen.add(outcome.url);
        if (item.depth >= maxDepth) continue;
        for (const url of linksOf(outcome.html, outcome.url, item.depth + 1)) {
          if (seen.has(url)) continue;
          seen.add(url);
          queue.push({ url, depth: item.depth + 1 });
        }
      }
    }
  }

  const checks: RouteCheck[] = [];
  for (const url of checkUrls) checks.push(await checkRoute(client, url, intervalMs));

  return {
    checks,
    origin,
    source,
    robotsTxtFound,
    sitemapFiles: sitemap.files,
    routes: [...state.routes.values()],
    blockedByRobots: state.blockedByRobots.size,
    failed: state.failed,
  };
}

function crawlInterval(robots: RobotsRules): number | undefined {
  return robots.crawlDelayMs === undefined
    ? undefined
    : Math.min(robots.crawlDelayMs, MAX_CRAWL_DELAY_MS);
}

async function loadRobots(client: HttpClient, baseUrl: string, robotsAgent: string) {
  let origin = new URL(baseUrl).origin;
  let content: string | null = null;
  try {
    const res = await client.get(`${origin}/robots.txt`);
    origin = new URL(res.url).origin;
    if (res.status === 200) content = res.body.toString('utf8');
  } catch (err) {
    if (!(err instanceof FetchFailedError)) throw err;
  }
  return {
    robots: parseRobots(`${origin}/robots.txt`, content, robotsAgent),
    robotsTxtFound: content !== null,
    origin,
  };
}

function analyzePage(res: HttpResponse, origin: string): PageOutcome {
  // Redirecionou para login/SSO, mesmo em outro host: a URL pedida é de área autenticada.
  if (res.redirected && isAuthUrl(res.url)) {
    const url = normalizeUrl(res.requestedUrl);
    return url ? { kind: 'authenticated', url, title: undefined } : { kind: 'skipped' };
  }
  if (res.status >= 400 || !/html/i.test(res.contentType)) return { kind: 'skipped' };

  const url = normalizeUrl(res.url);
  if (!url || !isSameOrigin(url, origin)) return { kind: 'skipped' };

  const html = decodeHtml(res.body, res.contentType);
  const page = parseHtml(html);
  if (
    isAuthenticatedArea({
      redirected: res.redirected,
      finalUrl: res.url,
      hasPasswordField: page.hasPasswordField,
    })
  ) {
    return { kind: 'authenticated', url, title: page.title };
  }
  return { kind: 'page', url, title: page.title, html };
}

async function collectSitemapUrls(
  client: HttpClient,
  origin: string,
  domain: string,
  robots: RobotsRules,
  intervalMs: number | undefined,
): Promise<{ urls: string[]; files: string[] }> {
  const declared = robots.sitemaps
    .map((s) => normalizeUrl(s, origin))
    .filter(
      (s): s is string =>
        s !== null && isWithinDomain(new URL(s).host, domain) && !isDevHost(new URL(s).host),
    );

  const urls: string[] = [];
  const files: string[] = [];
  const fetched = new Set<string>();

  const readSitemap = async (url: string, depth: number): Promise<boolean> => {
    if (fetched.has(url) || fetched.size >= MAX_SITEMAP_FILES) return false;
    fetched.add(url);
    let parsed;
    try {
      const res = await client.get(url, { intervalMs });
      if (res.status !== 200) return false;
      parsed = parseSitemap(decodeSitemapBody(res.body));
    } catch (err) {
      if (err instanceof FetchFailedError) return false;
      // Conteúdo gzip corrompido etc.: trata como sitemap inválido.
      return false;
    }
    if (parsed.kind === 'invalid') return false;
    files.push(url);
    if (parsed.kind === 'urlset') {
      urls.push(...parsed.urls);
    } else if (depth < MAX_SITEMAP_INDEX_DEPTH) {
      // Páginas institucionais antes de notícias: se o limite de arquivos apertar, sobram notícias.
      for (const child of [...parsed.sitemaps].sort((a, b) => sitemapRank(a) - sitemapRank(b))) {
        const childUrl = normalizeUrl(child, url);
        if (childUrl && isWithinDomain(new URL(childUrl).host, domain))
          await readSitemap(childUrl, depth + 1);
      }
    }
    return true;
  };

  for (const url of declared) await readSitemap(url, 0);
  // Sem sitemap declarado, ou com o declarado quebrado: tenta os caminhos padrão.
  if (urls.length === 0) {
    for (const path of FALLBACK_SITEMAPS) {
      const url = `${origin}${path}`;
      if (robots.isAllowed(url) && (await readSitemap(url, 0))) break;
    }
  }

  return { urls, files };
}

/** Ordem de leitura dos sitemaps filhos: páginas primeiro, notícias e posts por último. */
function sitemapRank(url: string): number {
  if (/page|pagina/i.test(url)) return 0;
  if (/post|noticia|news|event|tag|categor|author/i.test(url)) return 2;
  return 1;
}

async function checkRoute(
  client: HttpClient,
  url: string,
  intervalMs: number | undefined,
): Promise<RouteCheck> {
  try {
    const res = await client.get(url, { intervalMs });
    const firstHop = res.redirects[0];
    if (firstHop && (firstHop.status === 301 || firstHop.status === 308)) {
      return { url, result: 'moved', httpStatus: firstHop.status, movedTo: normalizeUrl(res.url) };
    }
    if (res.status === 404 || res.status === 410) {
      return { url, result: 'not_found', httpStatus: res.status, movedTo: null };
    }
    return { url, result: 'ok', httpStatus: res.status, movedTo: null };
  } catch (err) {
    if (err instanceof FetchFailedError)
      return { url, result: 'unreachable', httpStatus: null, movedTo: null };
    throw err;
  }
}
