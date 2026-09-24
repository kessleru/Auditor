import { readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

/** Servidor HTTP local para os testes do motor de auditoria (sem rede externa). */
export async function startLocalSite(
  pages: Record<string, string | { status: number; body: string; contentType?: string }>,
) {
  const server: Server = createServer((req, res) => {
    const page = pages[req.url ?? '/'];
    if (page === undefined) {
      res.writeHead(404, { 'content-type': 'text/html' }).end('<!doctype html><title>404</title>');
      return;
    }
    const {
      status,
      body,
      contentType = 'text/html; charset=utf-8',
    } = typeof page === 'string' ? { status: 200, body: page } : page;
    res.writeHead(status, { 'content-type': contentType }).end(body);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    origin: `http://127.0.0.1:${port}`,
    host: `127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

export const htmlFixture = (name: string) =>
  readFileSync(new URL(`./${name}`, import.meta.url), 'utf8');

/** Uma porta local sem ninguém ouvindo: simula falha de rede. */
export async function closedPortUrl(): Promise<string> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return `http://127.0.0.1:${port}/`;
}
