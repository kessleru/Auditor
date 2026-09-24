import { X509Certificate } from 'node:crypto';
import tls from 'node:tls';
import { Agent, type Dispatcher, fetch as undiciFetch, ProxyAgent } from 'undici';
import { HostThrottle, sharedHostThrottle, systemClock } from './throttle.js';
import {
  defaultRoots,
  isIncompleteChainError,
  missingIntermediates,
  peerCertificate,
} from './tls-chain.js';

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
    /** Falha de rede que pode passar numa nova tentativa (não é o caso de resposta grande demais). */
    readonly transient = true,
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
  /** Novas tentativas após falha de rede ou HTTP 429/503 (padrão 1). */
  retries?: number;
  /** Espera antes da nova tentativa, sem `Retry-After` (padrão 3 s). */
  retryDelayMs?: number;
  /** `Retry-After` acima disto não é esperado: a resposta volta como veio (padrão 30 s). */
  maxRetryAfterMs?: number;
  sleep?: (ms: number) => Promise<void>;
  /** Raízes confiáveis em PEM, para completar cadeias TLS (padrão: as do Node). */
  trustedRoots?: readonly string[];
  /** Baixa um certificado do AIA (padrão: GET simples com o user-agent). */
  downloadCertificate?: (url: string) => Promise<Buffer>;
  /**
   * Proxy HTTP(S) da rede institucional (ex.: http://proxy.iftm.edu.br:3128), para quando a
   * máquina só sai para a internet por ele. Com proxy, a cadeia TLS não é completada pelo AIA.
   */
  proxy?: string;
}

/** Espera pedida por `Retry-After` (segundos ou data HTTP), em ms; `null` se ausente ou inválida. */
export function parseRetryAfter(value: string | null, now = Date.now()): number | null {
  if (!value) return null;
  if (/^\d+$/.test(value.trim())) return Number(value.trim()) * 1000;
  const date = Date.parse(value);
  return Number.isNaN(date) ? null : Math.max(0, date - now);
}

export function createHttpClient({
  userAgent,
  fetch = globalThis.fetch,
  throttle = sharedHostThrottle,
  minIntervalMs = MIN_REQUEST_INTERVAL_MS,
  timeoutMs = 20_000,
  maxBytes = 10 * 1024 * 1024,
  maxRedirects = 5,
  retries = 1,
  retryDelayMs = 3000,
  maxRetryAfterMs = 30_000,
  sleep = systemClock.sleep,
  trustedRoots,
  downloadCertificate,
  proxy,
}: HttpClientOptions): HttpClient {
  const viaProxy: Dispatcher | undefined = proxy ? new ProxyAgent(proxy) : undefined;
  const headers = {
    'user-agent': userAgent,
    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'accept-language': 'pt-BR,pt;q=0.9',
  };

  // Hosts com cadeia TLS completada pelo AIA: as próximas requisições já usam a cadeia certa.
  const completedChains = new Map<string, Agent>();
  const roots = trustedRoots ? trustedRoots.map((pem) => new X509Certificate(pem)) : defaultRoots();
  const download =
    downloadCertificate ??
    (async (url: string) => {
      const res = await undiciFetch(url, {
        headers: { 'user-agent': userAgent },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    });

  const completeChain = async (url: URL): Promise<Agent | null> => {
    const leaf = await peerCertificate(url.hostname, Number(url.port || 443));
    const intermediates = await missingIntermediates(leaf, download, roots);
    if (intermediates.length === 0) return null;
    const agent = new Agent({
      connect: { ca: [...(trustedRoots ?? tls.rootCertificates), ...intermediates] },
    });
    completedChains.set(url.host, agent);
    return agent;
  };

  const request = async (url: string): Promise<Response> => {
    const init = { redirect: 'manual' as const, headers, signal: AbortSignal.timeout(timeoutMs) };
    const target = new URL(url);
    if (viaProxy) {
      return (await undiciFetch(url, { ...init, dispatcher: viaProxy })) as unknown as Response;
    }
    const known = completedChains.get(target.host);
    if (known) {
      return (await undiciFetch(url, { ...init, dispatcher: known })) as unknown as Response;
    }
    try {
      return await fetch(url, init);
    } catch (err) {
      if (target.protocol !== 'https:' || !isIncompleteChainError(err)) throw err;
      const agent = await completeChain(target).catch(() => null);
      if (!agent) throw err;
      return (await undiciFetch(url, { ...init, dispatcher: agent })) as unknown as Response;
    }
  };

  const once = async (
    requestedUrl: string,
    intervalMs: number,
  ): Promise<{ response: HttpResponse; retryAfter: string | null }> => {
    const redirects: HttpResponse['redirects'] = [];
    let current = requestedUrl;

    for (;;) {
      // O intervalo nunca fica abaixo do mínimo do plano, mesmo que se peça menos.
      await throttle.wait(new URL(current).host, Math.max(intervalMs, minIntervalMs));

      let res: Response;
      try {
        res = await request(current);
      } catch (err) {
        throw new FetchFailedError(current, describeNetworkError(err));
      }

      const location = res.headers.get('location');
      if (res.status >= 300 && res.status < 400 && location) {
        await res.body?.cancel();
        if (redirects.length >= maxRedirects) {
          throw new FetchFailedError(requestedUrl, 'redirecionamentos demais', false);
        }
        redirects.push({ url: current, status: res.status });
        current = new URL(location, current).href;
        continue;
      }

      const declaredLength = Number(res.headers.get('content-length') ?? 0);
      if (declaredLength > maxBytes) {
        await res.body?.cancel();
        throw new FetchFailedError(current, 'resposta grande demais', false);
      }
      const body = Buffer.from(await res.arrayBuffer());
      if (body.length > maxBytes) {
        throw new FetchFailedError(current, 'resposta grande demais', false);
      }

      return {
        retryAfter: res.headers.get('retry-after'),
        response: {
          requestedUrl,
          url: current,
          status: res.status,
          redirected: redirects.length > 0,
          redirects,
          contentType: res.headers.get('content-type') ?? '',
          body,
        },
      };
    }
  };

  return {
    async get(requestedUrl, { intervalMs = minIntervalMs } = {}) {
      for (let attempt = 0; ; attempt++) {
        const last = attempt >= retries;
        let outcome;
        try {
          outcome = await once(requestedUrl, intervalMs);
        } catch (err) {
          // Falha de rede passageira (conexão caiu, tempo esgotado): uma nova tentativa.
          if (last || !(err instanceof FetchFailedError) || !err.transient) throw err;
          await sleep(retryDelayMs);
          continue;
        }
        const { response, retryAfter } = outcome;
        // Servidor sobrecarregado ou limitando o ritmo: espera o que ele pedir (até o teto).
        if (!last && (response.status === 429 || response.status === 503)) {
          const wait = parseRetryAfter(retryAfter) ?? retryDelayMs;
          if (wait <= maxRetryAfterMs) {
            await sleep(wait);
            continue;
          }
        }
        return response;
      }
    },
  };
}

/** Motivo da falha de rede, com o código do sistema quando houver (ex.: ENOTFOUND). */
function describeNetworkError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  const cause = (err as { cause?: { code?: unknown; message?: unknown } } | null)?.cause;
  if (cause && typeof cause.code === 'string') {
    return `${message} (${cause.code}${typeof cause.message === 'string' ? `: ${cause.message}` : ''})`;
  }
  return message;
}
