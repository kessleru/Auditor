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

const AXE_VERSION: string = createRequire(import.meta.url)('axe-core/package.json').version;

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
      const context = await (await getBrowser()).newContext({ viewport: VIEWPORT, userAgent });
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
            const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
            const html = await page.content();
            return { ok: true, httpStatus, finalUrl: page.url(), html, results };
          } catch (err) {
            lastError = err;
            if (!isNetworkError(err)) break;
          } finally {
            await page.close().catch(() => {});
          }
        }
        return { ok: false, httpStatus: null, error: firstLine(lastError) };
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
