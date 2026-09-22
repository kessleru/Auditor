import type { PageFunctionKey, RouteSource } from '@auditoria-rf/contracts';
import { isAuthenticatedArea, isAuthUrl } from './auth-detection.js';
import { parseHtml } from './html.js';
import { FetchFailedError, type HttpClient, type HttpResponse } from './http.js';
import { parseRobots, type RobotsRules } from './robots.js';
import { decodeSitemapBody, parseSitemap } from './sitemap.js';
import { suggestFunction } from './suggest-function.js';
import {
  DEV_HOST_REASON,
  isDevHost,
  isNavigable,
  isSameOrigin,
  isWithinDomain,
  normalizeUrl,
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
  suggestedFunction: PageFunctionKey | null;
  exclusionReason?: string;
  title?: string;
}

export interface DiscoveryResult {
  origin: string;
  source: Extract<RouteSource, 'sitemap' | 'crawler'>;
  robotsTxtFound: boolean;
  sitemapFiles: string[];
  routes: DiscoveredRoute[];
  /** URLs não visitadas porque o robots.txt proíbe. */
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
    blockedByRobots: 0,
    failed: 0,
  };

  const addExcluded = (url: string, reason: string) => {
    if (!state.routes.has(url)) {
      state.routes.set(url, {
        url,
        status: 'excluded',
        suggestedFunction: null,
        exclusionReason: reason,
      });
    }
  };

  /** Classifica um link encontrado: candidato, excluído (homologação) ou ignorado. */
  const screen = (raw: string, base: string): string | null => {
    const url = normalizeUrl(raw, base);
    if (!url) return null;
    if (!isSameOrigin(url, origin)) {
      const { host } = new URL(url);
      if (isWithinDomain(host, domain) && isDevHost(host)) addExcluded(url, DEV_HOST_REASON);
      return null;
    }
    if (!isNavigable(url)) return null;
    if (!robots.isAllowed(url)) {
      state.blockedByRobots++;
      return null;
    }
    return url;
  };

  const record = (outcome: PageOutcome, linkText?: string) => {
    if (outcome.kind === 'skipped') {
      state.failed++;
      return;
    }
    if (state.routes.has(outcome.url)) return;
    state.routes.set(outcome.url, {
      url: outcome.url,
      status: outcome.kind === 'authenticated' ? 'authenticated' : 'suggested',
      suggestedFunction: suggestFunction({ url: outcome.url, title: outcome.title, linkText }),
      ...(outcome.title !== undefined && { title: outcome.title }),
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

  // 1) Sitemap: declarado no robots.txt ou em um dos caminhos padrão.
  const sitemap = await collectSitemapUrls(client, origin, domain, robots, intervalMs);
  const sitemapCandidates = [...new Set(sitemap.urls.map((u) => screen(u, origin)))].filter(
    (u): u is string => u !== null && u !== homeUrl,
  );

  let source: DiscoveryResult['source'];
  if (sitemapCandidates.length > 0) {
    source = 'sitemap';
    record(homeOutcome);
    // Teto: primeiro as URLs cujo caminho sugere uma das funções, depois as demais na ordem do sitemap.
    const prioritized = [
      ...sitemapCandidates.filter((url) => suggestFunction({ url }) !== null),
      ...sitemapCandidates.filter((url) => suggestFunction({ url }) === null),
    ].slice(0, maxUrls - 1);
    for (const url of prioritized) record(await visit(url));
  } else {
    // 2) Sem sitemap: crawler em largura a partir da página inicial.
    source = 'crawler';
    const seen = new Set([homeUrl]);
    const queue: { url: string; depth: number; linkText?: string }[] = [];
    let visits = 1;

    const enqueueLinks = (html: string, pageUrl: string, depth: number) => {
      if (depth >= maxDepth) return;
      const page = parseHtml(html);
      const base = page.baseHref ? (normalizeUrl(page.baseHref, pageUrl) ?? pageUrl) : pageUrl;
      for (const link of page.links) {
        const url = screen(link.href, base);
        if (!url || seen.has(url)) continue;
        seen.add(url);
        queue.push({ url, depth: depth + 1, linkText: link.text || undefined });
      }
    };

    record(homeOutcome);
    enqueueLinks(homeOutcome.html, homeUrl, 0);

    while (queue.length > 0 && visits < maxUrls) {
      const item = queue.shift() as (typeof queue)[number];
      visits++;
      const outcome = await visit(item.url);
      record(outcome, item.linkText);
      if (outcome.kind === 'page') {
        seen.add(outcome.url);
        enqueueLinks(outcome.html, outcome.url, item.depth);
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
    blockedByRobots: state.blockedByRobots,
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

  const html = res.body.toString('utf8');
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
      for (const child of parsed.sitemaps) {
        const childUrl = normalizeUrl(child, url);
        if (childUrl && isWithinDomain(new URL(childUrl).host, domain))
          await readSitemap(childUrl, depth + 1);
      }
    }
    return true;
  };

  if (declared.length > 0) {
    for (const url of declared) await readSitemap(url, 0);
  } else {
    for (const path of FALLBACK_SITEMAPS) {
      const url = `${origin}${path}`;
      if (robots.isAllowed(url) && (await readSitemap(url, 0))) break;
    }
  }

  return { urls, files };
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
