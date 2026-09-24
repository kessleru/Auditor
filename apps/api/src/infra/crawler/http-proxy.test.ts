import { createServer, type Server } from 'node:http';
import { connect, type AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHttpClient } from './http.js';
import { HostThrottle } from './throttle.js';

// Rede institucional que só sai para a internet por proxy: o crawler usa CRAWLER_PROXY.

let target: Server;
let proxy: Server;
const tunnels: string[] = [];
const port = (server: Server) => (server.address() as AddressInfo).port;

beforeAll(async () => {
  target = createServer((_req, res) =>
    res.writeHead(200, { 'content-type': 'text/html' }).end('<title>Portal</title>'),
  );
  // Proxy mínimo com CONNECT, como os de rede corporativa.
  proxy = createServer((_req, res) => res.writeHead(405).end());
  proxy.on('connect', (req, socket, head) => {
    tunnels.push(req.url ?? '');
    const [host, p] = (req.url ?? '').split(':');
    const upstream = connect(Number(p), host, () => {
      socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      upstream.write(head);
      upstream.pipe(socket).pipe(upstream);
    });
    upstream.on('error', () => socket.destroy());
  });
  await Promise.all(
    [target, proxy].map((s) => new Promise<void>((r) => s.listen(0, '127.0.0.1', r))),
  );
});

afterAll(async () => {
  await Promise.all([target, proxy].map((s) => new Promise<void>((r) => s.close(() => r()))));
});

describe('crawler atrás de proxy', () => {
  it('passa as requisições pelo proxy configurado', async () => {
    const client = createHttpClient({
      userAgent: 'UA',
      throttle: new HostThrottle(),
      minIntervalMs: 0,
      proxy: `http://127.0.0.1:${port(proxy)}`,
    });
    const res = await client.get(`http://127.0.0.1:${port(target)}/`);
    expect(res.status).toBe(200);
    expect(res.body.toString()).toContain('Portal');
    expect(tunnels).toEqual([`127.0.0.1:${port(target)}`]);
  });
});
