import { createRequire } from 'node:module';
import { AxeBuilder } from '@axe-core/playwright';
import type { AxeResults, Result } from 'axe-core';
import { type Browser, type BrowserContext, chromium, errors, type Page } from 'playwright';
import { MIN_REQUEST_INTERVAL_MS } from '../crawler/http.js';
import { type HostThrottle, sharedHostThrottle } from '../crawler/throttle.js';
import { selectorOf } from './axe-mapping.js';

// Auditoria automatizada de uma página (seção 3.2 do plano).

export const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
export const VIEWPORT = { width: 1280, height: 800 };
export const NAVIGATION_TIMEOUT_MS = 30_000;

// A versão registrada é a do axe-core que o @axe-core/playwright injeta na página (a resolvida a
// partir dele), não a de qualquer axe-core que esteja no projeto. Ver também a conferência com
// `results.testEngine.version` em cada página.
const requireHere = createRequire(import.meta.url);
export const AXE_VERSION: string = createRequire(requireHere.resolve('@axe-core/playwright'))(
  'axe-core/package.json',
).version;

export interface AuditorVersions {
  axeVersion: string;
  browserVersion: string;
  userAgent: string;
}

/** Foto de um elemento reprovado, casada com o achado pela regra e pelo seletor (ADR 0014). */
export interface ElementScreenshot {
  ruleId: string;
  selector: string;
  image: Buffer;
}

export type AuditOutcome =
  | {
      ok: true;
      httpStatus: number | null;
      finalUrl: string;
      html: string;
      results: AxeResults;
      screenshots: ElementScreenshot[];
    }
  | { ok: false; httpStatus: number | null; error: string };

export const MAX_SCREENSHOTS_PER_PAGE = 30;
const SCREENSHOT_MARGIN_PX = 16;
const MAX_SCREENSHOT_HEIGHT_PX = 600;
const HIGHLIGHT_ATTRIBUTE = 'data-auditoria-rf-alvo';

/**
 * Fotografa os elementos reprovados, com uma margem para mostrar o fundo e a vizinhança e um
 * contorno de destaque. Roda depois do axe e do snapshot: não muda o que foi avaliado nem o HTML
 * salvo. Elemento em iframe ou shadow DOM, invisível, ou a página inteira (`html`, `body`) fica
 * sem foto; uma foto que falha nunca falha a página.
 */
async function captureElements(page: Page, violations: Result[]): Promise<ElementScreenshot[]> {
  const shots: ElementScreenshot[] = [];
  const seen = new Set<string>();
  const viewport = page.viewportSize() ?? VIEWPORT;
  await page
    .addStyleTag({
      content: `[${HIGHLIGHT_ATTRIBUTE}]{outline:3px solid #d4351c !important;outline-offset:2px !important}`,
    })
    .catch(() => {});

  for (const rule of violations) {
    for (const node of rule.nodes) {
      if (shots.length >= MAX_SCREENSHOTS_PER_PAGE) return shots;
      const [target] = node.target;
      if (node.target.length !== 1 || typeof target !== 'string') continue;
      const selector = selectorOf(node.target);
      const key = `${rule.id} ${selector}`;
      if (seen.has(key)) continue;
      seen.add(key);
      try {
        const element = await page.$(`css=${target}`);
        if (!element) continue;
        const tag = await element.evaluate((el) => el.tagName.toLowerCase());
        if (tag === 'html' || tag === 'body') continue;
        await element.scrollIntoViewIfNeeded({ timeout: 2000 });
        const box = await element.boundingBox();
        if (!box || box.width < 1 || box.height < 1) continue;
        const x = Math.max(0, box.x - SCREENSHOT_MARGIN_PX);
        const y = Math.max(0, box.y - SCREENSHOT_MARGIN_PX);
        const clip = {
          x,
          y,
          width: Math.min(viewport.width - x, box.x + box.width + SCREENSHOT_MARGIN_PX - x),
          height: Math.min(
            viewport.height - y,
            MAX_SCREENSHOT_HEIGHT_PX,
            box.y + box.height + SCREENSHOT_MARGIN_PX - y,
          ),
        };
        if (clip.width < 1 || clip.height < 1) continue;
        await element.evaluate((el, name) => el.setAttribute(name, ''), HIGHLIGHT_ATTRIBUTE);
        const image = await page.screenshot({
          clip,
          type: 'jpeg',
          quality: 75,
          animations: 'disabled',
          timeout: 5000,
        });
        await element.evaluate((el, name) => el.removeAttribute(name), HIGHLIGHT_ATTRIBUTE);
        shots.push({ ruleId: rule.id, selector, image });
      } catch {
        // A foto é complemento: sem ela, o achado mostra só o código.
      }
    }
  }
  return shots;
}

export interface PageAuditor {
  versions(): Promise<AuditorVersions>;
  audit(url: string): Promise<AuditOutcome>;
  close(): Promise<void>;
}

export interface PlaywrightAuditorOptions {
  userAgent: string;
  throttle?: HostThrottle;
  minIntervalMs?: number;
  navigationTimeoutMs?: number;
  launch?: () => Promise<Browser>;
  /** Proxy da rede institucional, o mesmo do crawler (CRAWLER_PROXY). */
  proxy?: string;
}

/**
 * Merece uma tentativa extra: falha de rede, inclusive o tempo esgotado (seção 3.2.1), e falhas
 * do próprio navegador que não dizem nada sobre a página (processo caiu, a página redirecionou por
 * script no meio da análise e o contexto de execução se perdeu).
 */
export function isTransientFailure(err: unknown): boolean {
  if (err instanceof errors.TimeoutError) return true;
  return (
    err instanceof Error &&
    /net::ERR_|NS_ERROR_|ECONNREFUSED|ECONNRESET|ENOTFOUND|Execution context was destroyed|Target (?:page, context or browser )?(?:has been )?closed|Browser has been closed|Page crashed|crashed/i.test(
      err.message,
    )
  );
}

const firstLine = (err: unknown) =>
  (err instanceof Error ? err.message : String(err)).split('\n')[0] ?? '';

const NETWORK_ERRORS: [RegExp, string][] = [
  [/ERR_NAME_NOT_RESOLVED|ENOTFOUND/, 'Endereço não encontrado (falha de DNS)'],
  [/ERR_CONNECTION_REFUSED|ECONNREFUSED/, 'Conexão recusada pelo servidor'],
  [/ERR_CONNECTION_RESET|ECONNRESET/, 'Conexão interrompida pelo servidor'],
  [/ERR_CONNECTION_TIMED_OUT|ERR_TIMED_OUT/, 'O servidor não respondeu a tempo'],
  [/ERR_CERT_|ERR_SSL_/, 'Certificado de segurança (TLS) inválido'],
  [/ERR_TOO_MANY_REDIRECTS/, 'Redirecionamentos demais'],
  [/ERR_INTERNET_DISCONNECTED|ERR_NETWORK_CHANGED/, 'Sem conexão com a internet'],
];

/** Mensagem da falha em português, com o código técnico entre parênteses para diagnóstico. */
export function describeFailure(err: unknown, timeoutMs: number): string {
  if (err instanceof errors.TimeoutError) {
    return `Tempo esgotado: a página não terminou de carregar em ${Math.round(timeoutMs / 1000)} s (a coleta espera a rede ficar ociosa).`;
  }
  const line = firstLine(err);
  if (/Executable doesn't exist|browserType\.launch/i.test(line)) {
    return 'O navegador do Playwright não abriu. Instale com: npx playwright install chromium.';
  }
  if (/Download is starting/i.test(line)) {
    return 'A URL baixa um arquivo em vez de abrir uma página.';
  }
  const code = /net::ERR_[A-Z_]+|E[A-Z]{4,}/.exec(line)?.[0];
  const known = NETWORK_ERRORS.find(([pattern]) => pattern.test(line));
  if (known) return `${known[1]}${code ? ` (${code})` : ''}.`;
  return line;
}

/** Só HTML (ou XHTML) é auditado: PDF, imagem ou JSON aberto no navegador não é página do portal. */
const isHtml = (contentType: string | undefined) =>
  contentType === undefined || /html|xml/i.test(contentType);

export function createPlaywrightAuditor({
  userAgent,
  throttle = sharedHostThrottle,
  minIntervalMs = MIN_REQUEST_INTERVAL_MS,
  navigationTimeoutMs = NAVIGATION_TIMEOUT_MS,
  proxy,
  launch = () => chromium.launch(proxy ? { proxy: { server: proxy } } : {}),
}: PlaywrightAuditorOptions): PageAuditor {
  let browser: Promise<Browser> | null = null;
  // O navegador é reaproveitado entre páginas. Se ele cair (falta de memória, processo morto) ou
  // não conseguir abrir, a referência é descartada e a próxima página abre outro: antes, um
  // navegador morto ficava guardado e derrubava todas as páginas seguintes da coleta.
  const getBrowser = () => {
    if (!browser) {
      const launching = launch().then(
        (opened) => {
          opened.once('disconnected', () => {
            if (browser === launching) browser = null;
          });
          return opened;
        },
        (err: unknown) => {
          if (browser === launching) browser = null;
          throw err;
        },
      );
      browser = launching;
    }
    return browser;
  };

  return {
    async versions() {
      return {
        axeVersion: AXE_VERSION,
        browserVersion: `Chromium ${(await getBrowser()).version()}`,
        userAgent,
      };
    },

    async audit(url) {
      const host = new URL(url).host;
      let lastError: unknown;
      for (let attempt = 1; attempt <= 2; attempt++) {
        let context: BrowserContext | undefined;
        try {
          context = await (
            await getBrowser()
          ).newContext({ viewport: VIEWPORT, userAgent, locale: 'pt-BR' });
          const page = await context.newPage();
          await throttle.wait(host, minIntervalMs);
          const response = await page.goto(url, {
            waitUntil: 'networkidle',
            timeout: navigationTimeoutMs,
          });
          const httpStatus = response?.status() ?? null;
          if (httpStatus !== null && httpStatus >= 400) {
            return { ok: false, httpStatus, error: `A página respondeu HTTP ${httpStatus}.` };
          }
          const contentType = response?.headers()['content-type'];
          if (!isHtml(contentType)) {
            return {
              ok: false,
              httpStatus,
              error: `A URL não é uma página HTML (${contentType?.split(';')[0]}).`,
            };
          }
          const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
          if (results.testEngine.version !== AXE_VERSION) {
            // Protege a reprodutibilidade: a versão gravada na coleta tem de ser a executada.
            return {
              ok: false,
              httpStatus,
              error: `O axe-core executado (${results.testEngine.version}) difere do registrado na coleta (${AXE_VERSION}).`,
            };
          }
          const html = await page.content();
          const screenshots = await captureElements(page, results.violations);
          return { ok: true, httpStatus, finalUrl: page.url(), html, results, screenshots };
        } catch (err) {
          lastError = err;
          if (!isTransientFailure(err)) break;
        } finally {
          await context?.close().catch(() => {});
        }
      }
      return {
        ok: false,
        httpStatus: null,
        error: describeFailure(lastError, navigationTimeoutMs),
      };
    },

    async close() {
      if (browser) await (await browser).close();
      browser = null;
    },
  };
}
