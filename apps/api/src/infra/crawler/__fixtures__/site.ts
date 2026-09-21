import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import type { HttpClient, HttpResponse } from '../http.js';
import { FetchFailedError } from '../http.js';

// Site falso em memória para testar a descoberta sem rede.

export type FakeResource =
  | { redirect: string; status?: 301 | 302 | 307 | 308 }
  | { status?: number; body: string | Buffer; contentType?: string }
  | { networkError: true };

export function fixture(name: string): string {
  return readFileSync(new URL(`./${name}`, import.meta.url), 'utf8');
}

export const gz = (text: string) => gzipSync(Buffer.from(text));

export const html = (title: string, body = '') =>
  `<!doctype html><html><head><title>${title}</title></head><body>${body}</body></html>`;

export const links = (...hrefs: (string | [string, string])[]) =>
  hrefs
    .map((h) => (Array.isArray(h) ? `<a href="${h[0]}">${h[1]}</a>` : `<a href="${h}">link</a>`))
    .join('');

export function fakeSite(resources: Record<string, FakeResource>) {
  const requested: string[] = [];

  const client: HttpClient = {
    async get(url) {
      const redirects: HttpResponse['redirects'] = [];
      let current = url;
      for (;;) {
        requested.push(current);
        const resource = resources[current];
        if (resource && 'networkError' in resource)
          throw new FetchFailedError(current, 'ECONNRESET');
        if (resource && 'redirect' in resource) {
          redirects.push({ url: current, status: resource.status ?? 301 });
          current = new URL(resource.redirect, current).href;
          continue;
        }
        const found = resource ?? {
          status: 404,
          body: 'não encontrado',
          contentType: 'text/plain',
        };
        const body = Buffer.isBuffer(found.body) ? found.body : Buffer.from(found.body);
        return {
          requestedUrl: url,
          url: current,
          status: found.status ?? 200,
          redirected: redirects.length > 0,
          redirects,
          contentType:
            found.contentType ??
            (current.includes('.xml') ? 'application/xml' : 'text/html; charset=utf-8'),
          body,
        };
      }
    },
  };

  /** Requisições feitas a páginas (exclui robots.txt e sitemaps). */
  const pageRequests = () => requested.filter((u) => !/robots\.txt|sitemap/.test(u));

  return { client, requested, pageRequests };
}
