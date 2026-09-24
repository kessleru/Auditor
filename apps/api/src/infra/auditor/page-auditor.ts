import { createRequire } from 'node:module';
import { AxeBuilder } from '@axe-core/playwright';
import type { AxeResults } from 'axe-core';
import { type Browser, chromium, errors } from 'playwright';
import { MIN_REQUEST_INTERVAL_MS } from '../crawler/http.js';
import { type HostThrottle, sharedHostThrottle } from '../crawler/throttle.js';

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

export type AuditOutcome =
  | { ok: true; httpStatus: number | null; finalUrl: string; html: string; results: AxeResults }
  | { ok: false; httpStatus: number | null; error: string };

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
}

/** Falha de rede (inclui o tempo esgotado): merece uma tentativa extra (seção 3.2.1). */
function isNetworkError(err: unknown): boolean {
  if (err instanceof errors.TimeoutError) return true;
  return (
    err instanceof Error &&
    /net::ERR_|NS_ERROR_|ECONNREFUSED|ECONNRESET|ENOTFOUND/.test(err.message)
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
  launch = () => chromium.launch(),
}: PlaywrightAuditorOptions): PageAuditor {
  let browser: Promise<Browser> | null = null;
  const getBrowser = () => (browser ??= launch());

  return {
    async versions() {
      return {
        axeVersion: AXE_VERSION,
        browserVersion: `Chromium ${(await getBrowser()).version()}`,
        userAgent,
      };
    },

    async audit(url) {
      const context = await (
        await getBrowser()
      ).newContext({
        viewport: VIEWPORT,
        userAgent,
        locale: 'pt-BR',
      });
      const host = new URL(url).host;
      let lastError: unknown;
      try {
        for (let attempt = 1; attempt <= 2; attempt++) {
          const page = await context.newPage();
          try {
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
            return { ok: true, httpStatus, finalUrl: page.url(), html, results };
          } catch (err) {
            lastError = err;
            if (!isNetworkError(err)) break;
          } finally {
            await page.close().catch(() => {});
          }
        }
        return {
          ok: false,
          httpStatus: null,
          error: describeFailure(lastError, navigationTimeoutMs),
        };
      } finally {
        await context.close().catch(() => {});
      }
    },

    async close() {
      if (browser) await (await browser).close();
      browser = null;
    },
  };
}
