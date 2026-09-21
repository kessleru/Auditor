import { describe, expect, it } from 'vitest';
import { createHttpClient, FetchFailedError } from './http.js';
import { type Clock, HostThrottle } from './throttle.js';

function fakeClock() {
  let time = 0;
  const sleeps: number[] = [];
  const clock: Clock = {
    now: () => time,
    sleep: async (ms) => {
      sleeps.push(ms);
      time += ms;
    },
  };
  return { clock, sleeps, advance: (ms: number) => (time += ms), now: () => time };
}

function fakeFetch(routes: Record<string, () => Response>) {
  const calls: { url: string; at: number; headers: Headers }[] = [];
  const make = (now: () => number): typeof fetch =>
    (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, at: now(), headers: new Headers(init?.headers) });
      const route = routes[url];
      if (!route) throw new TypeError('fetch failed');
      return route();
    }) as typeof fetch;
  return { calls, make };
}

describe('createHttpClient', () => {
  it('espera 1,5 s entre requisições ao mesmo host, mas não entre hosts diferentes', async () => {
    const { clock, now } = fakeClock();
    const { calls, make } = fakeFetch({
      'https://a.edu.br/1': () => new Response('ok'),
      'https://a.edu.br/2': () => new Response('ok'),
      'https://b.edu.br/1': () => new Response('ok'),
    });
    const client = createHttpClient({
      userAgent: 'UA',
      fetch: make(now),
      throttle: new HostThrottle(clock),
    });

    await client.get('https://a.edu.br/1');
    await client.get('https://b.edu.br/1');
    await client.get('https://a.edu.br/2');

    expect(calls.map((c) => [c.url, c.at])).toEqual([
      ['https://a.edu.br/1', 0],
      ['https://b.edu.br/1', 0],
      ['https://a.edu.br/2', 1500],
    ]);
  });

  it('serializa chamadas concorrentes ao mesmo host', async () => {
    const { clock, now } = fakeClock();
    const { calls, make } = fakeFetch({
      'https://a.edu.br/1': () => new Response('ok'),
      'https://a.edu.br/2': () => new Response('ok'),
      'https://a.edu.br/3': () => new Response('ok'),
    });
    const client = createHttpClient({
      userAgent: 'UA',
      fetch: make(now),
      throttle: new HostThrottle(clock),
    });

    await Promise.all(['1', '2', '3'].map((p) => client.get(`https://a.edu.br/${p}`)));
    expect(calls.map((c) => c.at)).toEqual([0, 1500, 3000]);
  });

  it('nunca usa intervalo menor que o mínimo, mas aceita um maior (crawl-delay)', async () => {
    const { clock, now } = fakeClock();
    const { calls, make } = fakeFetch({
      'https://a.edu.br/1': () => new Response('ok'),
      'https://a.edu.br/2': () => new Response('ok'),
      'https://a.edu.br/3': () => new Response('ok'),
    });
    const client = createHttpClient({
      userAgent: 'UA',
      fetch: make(now),
      throttle: new HostThrottle(clock),
    });

    await client.get('https://a.edu.br/1');
    await client.get('https://a.edu.br/2', { intervalMs: 100 });
    await client.get('https://a.edu.br/3', { intervalMs: 5000 });
    expect(calls.map((c) => c.at)).toEqual([0, 1500, 6500]);
  });

  it('segue redirecionamentos respeitando o intervalo em cada salto', async () => {
    const { clock, now } = fakeClock();
    const { calls, make } = fakeFetch({
      'https://if.edu.br/': () =>
        new Response(null, { status: 301, headers: { location: 'https://www.if.edu.br/' } }),
      'https://www.if.edu.br/': () =>
        new Response(null, { status: 302, headers: { location: '/inicio' } }),
      'https://www.if.edu.br/inicio': () =>
        new Response('<html></html>', { headers: { 'content-type': 'text/html' } }),
    });
    const client = createHttpClient({
      userAgent: 'UA',
      fetch: make(now),
      throttle: new HostThrottle(clock),
    });

    const res = await client.get('https://if.edu.br/');
    expect(res).toMatchObject({
      requestedUrl: 'https://if.edu.br/',
      url: 'https://www.if.edu.br/inicio',
      status: 200,
      redirected: true,
      redirects: [
        { url: 'https://if.edu.br/', status: 301 },
        { url: 'https://www.if.edu.br/', status: 302 },
      ],
      contentType: 'text/html',
    });
    expect(calls.map((c) => c.at)).toEqual([0, 0, 1500]);
  });

  it('envia o user-agent identificável', async () => {
    const { clock, now } = fakeClock();
    const { calls, make } = fakeFetch({ 'https://a.edu.br/': () => new Response('ok') });
    const client = createHttpClient({
      userAgent: 'AuditoriaRF/1.0',
      fetch: make(now),
      throttle: new HostThrottle(clock),
    });
    await client.get('https://a.edu.br/');
    expect(calls[0]?.headers.get('user-agent')).toBe('AuditoriaRF/1.0');
  });

  it('converte falha de rede em FetchFailedError', async () => {
    const { clock, now } = fakeClock();
    const { make } = fakeFetch({});
    const client = createHttpClient({
      userAgent: 'UA',
      fetch: make(now),
      throttle: new HostThrottle(clock),
    });
    await expect(client.get('https://fora.edu.br/')).rejects.toBeInstanceOf(FetchFailedError);
  });

  it('interrompe laços de redirecionamento', async () => {
    const { clock, now } = fakeClock();
    const { make } = fakeFetch({
      'https://a.edu.br/x': () => new Response(null, { status: 302, headers: { location: '/x' } }),
    });
    const client = createHttpClient({
      userAgent: 'UA',
      fetch: make(now),
      throttle: new HostThrottle(clock),
    });
    await expect(client.get('https://a.edu.br/x')).rejects.toThrow(/redirecionamentos demais/);
  });
});
