import { X509Certificate } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:https';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHttpClient, FetchFailedError } from './http.js';
import { HostThrottle } from './throttle.js';
import { caIssuerUrls, isIncompleteChainError, missingIntermediates } from './tls-chain.js';

// Cadeia de teste gerada por __fixtures__/tls/gen.sh: raiz → intermediária → folha (127.0.0.1).
// A chave da folha existe só para este teste.
const file = (name: string) => readFileSync(new URL(`./__fixtures__/tls/${name}`, import.meta.url));
const root = file('raiz.pem').toString();
const intermediateDer = file('intermediaria.der');
const leaf = new X509Certificate(file('folha.pem'));

describe('missingIntermediates', () => {
  const roots = [new X509Certificate(root)];

  it('lê o endereço CA Issuers do AIA', () => {
    expect(caIssuerUrls(leaf)).toEqual(['http://127.0.0.1:47123/intermediaria.der']);
  });

  it('baixa a intermediária que fecha a cadeia numa raiz confiável', async () => {
    const pems = await missingIntermediates(leaf, async () => intermediateDer, roots);
    expect(pems).toHaveLength(1);
    expect(new X509Certificate(pems[0]!).subject).toContain('Intermediaria de teste');
  });

  it('não aceita nada se a cadeia não chega a uma raiz confiável', async () => {
    expect(await missingIntermediates(leaf, async () => intermediateDer, [])).toEqual([]);
    expect(await missingIntermediates(leaf, async () => Buffer.from('lixo'), roots)).toEqual([]);
  });
});

describe('servidor com cadeia TLS incompleta', () => {
  let server: Server;
  let url: string;

  beforeAll(async () => {
    // O servidor manda só o certificado da folha, sem a intermediária: o erro comum.
    server = createServer({ key: file('folha.key'), cert: file('folha.pem') }, (_req, res) =>
      res.writeHead(200, { 'content-type': 'text/html' }).end('<title>Portal</title>'),
    );
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    url = `https://127.0.0.1:${(server.address() as AddressInfo).port}/`;
  });
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  const client = (download: (u: string) => Promise<Buffer>) =>
    createHttpClient({
      userAgent: 'UA',
      throttle: new HostThrottle(),
      minIntervalMs: 0,
      retries: 0,
      trustedRoots: [root],
      downloadCertificate: download,
    });

  it('o fetch do Node sozinho recusa (é o que acontecia antes)', async () => {
    const err = await fetch(url).catch((e: unknown) => e);
    expect(isIncompleteChainError(err)).toBe(true);
  });

  it('completa a cadeia pelo AIA e lê a página, verificando até a raiz', async () => {
    const downloads: string[] = [];
    const http = client(async (u) => {
      downloads.push(u);
      return intermediateDer;
    });
    const res = await http.get(url);
    expect(res.status).toBe(200);
    expect(res.body.toString()).toContain('Portal');
    // A segunda requisição reaproveita a cadeia completada.
    await http.get(url);
    expect(downloads).toEqual(['http://127.0.0.1:47123/intermediaria.der']);
  });

  it('sem intermediária válida, continua falhando', async () => {
    await expect(client(async () => Buffer.from('lixo')).get(url)).rejects.toBeInstanceOf(
      FetchFailedError,
    );
  });
});
