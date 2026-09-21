import { HostThrottle, sharedHostThrottle } from './throttle.js';

export const MIN_REQUEST_INTERVAL_MS = 1500;

export interface HttpResponse {
  requestedUrl: string;
  /** URL final, depois dos redirecionamentos. */
  url: string;
  status: number;
  redirected: boolean;
  /** Cada salto de redirecionamento, na ordem. */
  redirects: { url: string; status: number }[];
  contentType: string;
  body: Buffer;
}

export interface HttpClient {
  get(url: string, options?: { intervalMs?: number }): Promise<HttpResponse>;
}

export class FetchFailedError extends Error {
  constructor(
    readonly url: string,
    reason: string,
  ) {
    super(`Falha ao acessar ${url}: ${reason}`);
    this.name = 'FetchFailedError';
  }
}

export interface HttpClientOptions {
  userAgent: string;
  fetch?: typeof globalThis.fetch;
  throttle?: HostThrottle;
  minIntervalMs?: number;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
}

export function createHttpClient({
  userAgent,
  fetch = globalThis.fetch,
  throttle = sharedHostThrottle,
  minIntervalMs = MIN_REQUEST_INTERVAL_MS,
  timeoutMs = 20_000,
  maxBytes = 10 * 1024 * 1024,
  maxRedirects = 5,
}: HttpClientOptions): HttpClient {
  return {
    async get(requestedUrl, { intervalMs = minIntervalMs } = {}) {
      const redirects: HttpResponse['redirects'] = [];
      let current = requestedUrl;

      for (;;) {
        // O intervalo nunca fica abaixo do mínimo do plano, mesmo que se peça menos.
        await throttle.wait(new URL(current).host, Math.max(intervalMs, minIntervalMs));

        let res: Response;
        try {
          res = await fetch(current, {
            redirect: 'manual',
            headers: {
              'user-agent': userAgent,
              accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
            signal: AbortSignal.timeout(timeoutMs),
          });
        } catch (err) {
          throw new FetchFailedError(current, err instanceof Error ? err.message : String(err));
        }

        const location = res.headers.get('location');
        if (res.status >= 300 && res.status < 400 && location) {
          await res.body?.cancel();
          if (redirects.length >= maxRedirects) {
            throw new FetchFailedError(requestedUrl, 'redirecionamentos demais');
          }
          redirects.push({ url: current, status: res.status });
          current = new URL(location, current).href;
          continue;
        }

        const declaredLength = Number(res.headers.get('content-length') ?? 0);
        if (declaredLength > maxBytes) {
          await res.body?.cancel();
          throw new FetchFailedError(current, 'resposta grande demais');
        }
        const body = Buffer.from(await res.arrayBuffer());
        if (body.length > maxBytes) throw new FetchFailedError(current, 'resposta grande demais');

        return {
          requestedUrl,
          url: current,
          status: res.status,
          redirected: redirects.length > 0,
          redirects,
          contentType: res.headers.get('content-type') ?? '',
          body,
        };
      }
    },
  };
}
