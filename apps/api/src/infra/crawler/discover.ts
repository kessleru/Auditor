import type { DiscoveryProgress, PageFunctionKey, RouteSource } from '@auditoria-rf/contracts';
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

/** Explicação das respostas mais comuns de portais que recusam a ferramenta. */
const HTTP_HINTS: Record<number, string> = {
  403: ' (acesso negado: o portal ou um firewall pode estar bloqueando robôs ou a rede de origem)',
  429: ' (requisições demais: tente de novo mais tarde)',
  503: ' (serviço indisponível: o portal pode estar fora do ar ou em manutenção)',
};

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
  /**
   * A descoberta parou antes de percorrer tudo: `deadline` (passou do tempo máximo) ou
   * `failures` (falhas seguidas demais: o portal parou de responder ou passou a bloquear).
   * As rotas encontradas até ali ficam valendo.
   */
  stoppedEarly: 'deadline' | 'failures' | null;
  /**
   * Domínio fora da instituição para onde páginas foram redirecionadas (ex.: desafio de proteção
   * contra robôs). Essas páginas contam como falha; o domínio explica a parada ao auditor.
   */
  offDomainHost: string | null;
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
  /** Tempo máximo percorrendo páginas (padrão 20 min). */
  maxDurationMs?: number;
  /** Falhas seguidas que encerram a descoberta (padrão 10). */
  maxConsecutiveFailures?: number;
  /** Chamada a cada etapa e a cada página lida, para mostrar o andamento. */
  onProgress?: (progress: DiscoveryProgress) => void;
  now?: () => number;
}

export const DEFAULT_MAX_DURATION_MS = 20 * 60 * 1000;
export const DEFAULT_MAX_CONSECUTIVE_FAILURES = 10;

export class DiscoveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DiscoveryError';
  }
}

/** O portal mandou a ferramenta para outro domínio: bloqueio, nunca a nova origem (ADR 0016). */
const offDomainError = (host: string) =>
  new DiscoveryError(
    `O portal redirecionou para ${host}, fora do domínio da instituição: provável proteção contra robôs. A ferramenta não contorna bloqueios (o portal fica sem dado); a equipe de TI pode liberar o user-agent AuditoriaRF.`,
  );

type PageOutcome =
  | { kind: 'page'; url: string; title: string | undefined; html: string }
  | { kind: 'authenticated'; url: string; title: string | undefined }
  | { kind: 'skipped'; offDomainHost?: string };

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
  maxDurationMs = DEFAULT_MAX_DURATION_MS,
  maxConsecutiveFailures = DEFAULT_MAX_CONSECUTIVE_FAILURES,
  onProgress = () => {},
  now = Date.now,
}: DiscoveryOptions): Promise<DiscoveryResult> {
  const startedAt = now();
  if (isDevHost(domain)) throw new DiscoveryError(DEV_HOST_REASON);
  let progress: DiscoveryProgress = { phase: 'robots', visited: 0, planned: null };
  /** Só informa: um andamento que falha (ex.: canal fechado) não interrompe a descoberta. */
  const report = (change: Partial<DiscoveryProgress> = {}) => {
    progress = { ...progress, ...change };
    try {
      onProgress(progress);
    } catch {
      // ignorado de propósito
    }
  };
  report();

  // robots.txt antes de qualquer página; o redirecionamento dele já revela a origem canônica.
  // Domínio que não responde sem "www." (sem DNS ou sem servidor no endereço raiz) é tentado com
  // "www.", como faria quem digita o endereço no navegador.
  let opened: Awaited<ReturnType<typeof openPortal>>;
  try {
    opened = await openPortal(client, `https://${domain}`, robotsAgent, domain);
  } catch (err) {
    if (!(err instanceof FetchFailedError) || domain.startsWith('www.')) {
      throw new DiscoveryError(err instanceof Error ? err.message : String(err));
    }
    try {
      opened = await openPortal(client, `https://www.${domain}`, robotsAgent, domain);
    } catch (again) {
      throw new DiscoveryError(again instanceof Error ? again.message : String(again));
    }
  }
  let { robots, robotsTxtFound, origin } = opened;
  const { homeResponse } = opened;
  let intervalMs = crawlInterval(robots);
  const homeHost = new URL(homeResponse.url).hostname;
  if (!isWithinDomain(homeHost, domain)) throw offDomainError(homeHost);
  if (homeResponse.status >= 400) {
    throw new DiscoveryError(
      `A página inicial respondeu HTTP ${homeResponse.status}${HTTP_HINTS[homeResponse.status] ?? ''}.`,
    );
  }
  const homeOrigin = new URL(homeResponse.url).origin;
  if (isDevHost(new URL(homeOrigin).host)) throw new DiscoveryError(DEV_HOST_REASON);
  if (homeOrigin !== origin) {
    ({ robots, robotsTxtFound, origin } = await loadRobots(
      client,
      homeOrigin,
      robotsAgent,
      domain,
    ));
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
    offDomainHost: null as string | null,
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
    priorities.delete(url);
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

  /**
   * Relevância pelo que se sabe antes de visitar (URL e links): decide a ordem das visitas.
   * Calculada uma vez por URL e refeita só quando um novo link muda o que se sabe dela: a fila
   * do rastreamento tem milhares de URLs e é consultada a cada visita.
   */
  const priorities = new Map<string, number>();
  const priority = (url: string) => {
    const cached = priorities.get(url);
    if (cached !== undefined) return cached;
    const info = linkInfo.get(url);
    const score =
      suggestionRelevance({
        url,
        linkText: info?.text,
        inNav: info?.inNav ?? false,
        depth: info?.depth ?? DEFAULT_MAX_DEPTH,
      }).relevance ?? -1;
    priorities.set(url, score);
    return score;
  };

  let consecutiveFailures = 0;
  let stoppedEarly: DiscoveryResult['stoppedEarly'] = null;
  /** Parar de visitar? Portal que parou de responder não recebe mais requisições. */
  const shouldStop = () => {
    if (consecutiveFailures >= maxConsecutiveFailures) stoppedEarly = 'failures';
    else if (now() - startedAt >= maxDurationMs) stoppedEarly = 'deadline';
    return stoppedEarly !== null;
  };

  const record = (outcome: PageOutcome) => {
    if (outcome.kind === 'skipped') {
      if (outcome.offDomainHost) state.offDomainHost = outcome.offDomainHost;
      state.failed++;
      consecutiveFailures++;
      return;
    }
    consecutiveFailures = 0;
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
      return analyzePage(await client.get(url, { intervalMs }), origin, domain);
    } catch (err) {
      if (err instanceof FetchFailedError) return { kind: 'skipped' };
      throw err;
    } finally {
      report({ visited: progress.visited + 1 });
    }
  };

  const homeOutcome = analyzePage(homeResponse, origin, domain);
  if (homeOutcome.kind !== 'page') {
    throw new DiscoveryError('A página inicial não pôde ser lida como HTML público.');
  }
  record(homeOutcome);
  report({ phase: 'sitemap', visited: 1 });
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
    report({ phase: 'pages', planned: ranked.length + 1 });
    for (const { url } of ranked) {
      if (shouldStop()) break;
      record(await visit(url));
    }
  } else {
    // 2) Sem sitemap: crawler em largura a partir da página inicial. Dentro de cada nível, as
    // URLs mais relevantes primeiro, para o teto não cortar justamente as páginas das funções.
    source = 'crawler';
    const seen = new Set([homeUrl, ...homeLinks]);
    const queue: { url: string; depth: number }[] = homeLinks.map((url) => ({ url, depth: 1 }));
    let visits = 1;
    // Teto da rodada: o que já foi visitado mais a fila, sem passar do limite de URLs.
    const planned = () => Math.min(maxUrls, visits + queue.length);
    report({ phase: 'pages', planned: planned() });

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

    while (queue.length > 0 && visits < maxUrls && !shouldStop()) {
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
        if (planned() !== progress.planned) report({ planned: planned() });
      }
    }
  }

  const checks: RouteCheck[] = [];
  if (checkUrls.length > 0) report({ phase: 'checks' });
  for (const url of checkUrls) checks.push(await checkRoute(client, url, intervalMs));

  return {
    checks,
    origin,
    source,
    robotsTxtFound,
    sitemapFiles: sitemap.files,
    routes: [...state.routes.values()],
    blockedByRobots: state.blockedByRobots.size,
    stoppedEarly,
    failed: state.failed,
    offDomainHost: state.offDomainHost,
  };
}

function crawlInterval(robots: RobotsRules): number | undefined {
  return robots.crawlDelayMs === undefined
    ? undefined
    : Math.min(robots.crawlDelayMs, MAX_CRAWL_DELAY_MS);
}

/** robots.txt e página inicial a partir de `baseUrl`. Falha de rede na inicial propaga. */
async function openPortal(
  client: HttpClient,
  baseUrl: string,
  robotsAgent: string,
  domain: string,
) {
  const loaded = await loadRobots(client, baseUrl, robotsAgent, domain);
  const homeResponse = await client.get(`${loaded.origin}/`, {
    intervalMs: crawlInterval(loaded.robots),
  });
  return { ...loaded, homeResponse };
}

async function loadRobots(
  client: HttpClient,
  baseUrl: string,
  robotsAgent: string,
  domain: string,
) {
  let origin = new URL(baseUrl).origin;
  let content: string | null = null;
  try {
    const res = await client.get(`${origin}/robots.txt`);
    const host = new URL(res.url).hostname;
    // O redirecionamento do robots.txt revela a origem canônica, mas só dentro da instituição.
    if (!isWithinDomain(host, domain)) throw offDomainError(host);
    origin = new URL(res.url).origin;
    if (res.status === 200) content = res.body.toString('utf8');
    // RFC 9309 (2.3.1.4): robots.txt com erro de servidor = tudo proibido. Por cautela, a
    // descoberta não prossegue; 4xx (inexistente) libera, como antes.
    if (res.status >= 500 || res.status === 429) {
      throw new DiscoveryError(
        `O robots.txt respondeu HTTP ${res.status}: pelo protocolo (RFC 9309), sem ele o portal é tratado como proibido. Tente de novo mais tarde.`,
      );
    }
  } catch (err) {
    if (!(err instanceof FetchFailedError)) throw err;
  }
  return {
    robots: parseRobots(`${origin}/robots.txt`, content, robotsAgent),
    robotsTxtFound: content !== null,
    origin,
  };
}

function analyzePage(res: HttpResponse, origin: string, domain: string): PageOutcome {
  // Redirecionou para login/SSO, mesmo em outro host: a URL pedida é de área autenticada.
  if (res.redirected && isAuthUrl(res.url)) {
    const url = normalizeUrl(res.requestedUrl);
    return url ? { kind: 'authenticated', url, title: undefined } : { kind: 'skipped' };
  }
  const finalHost = new URL(res.url).hostname;
  if (!isWithinDomain(finalHost, domain)) return { kind: 'skipped', offDomainHost: finalHost };
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
