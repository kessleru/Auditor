import { X509Certificate } from 'node:crypto';
import tls from 'node:tls';

// Cadeia TLS incompleta: o servidor manda o certificado do site sem a intermediária. Navegadores
// completam a cadeia sozinhos, baixando a intermediária do endereço "CA Issuers" (AIA) do
// certificado; o Node não. Sem isso, a descoberta falharia em portais que abrem normalmente no
// navegador e na coleta (o Chromium faz a busca). A verificação continua completa: a intermediária
// só é aceita se estiver assinada por uma raiz confiável, e o nome do host é conferido pelo TLS.

const CHAIN_ERRORS = new Set([
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'UNABLE_TO_GET_ISSUER_CERT',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
]);

const MAX_INTERMEDIATES = 3;

/** O erro (ou a causa dele) é de cadeia incompleta? */
export function isIncompleteChainError(err: unknown): boolean {
  for (let current: unknown = err, i = 0; current && i < 5; i++) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === 'string' && CHAIN_ERRORS.has(code)) return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

/** Endereços "CA Issuers" do AIA do certificado. */
export function caIssuerUrls(cert: X509Certificate): string[] {
  return (cert.infoAccess ?? '')
    .split('\n')
    .map((line) => /^CA Issuers - URI:(\S+)/.exec(line.trim())?.[1])
    .filter((url): url is string => url !== undefined && /^https?:\/\//.test(url));
}

/** Certificado que o servidor apresenta, sem validar (só para ler o AIA). */
export function peerCertificate(host: string, port: number): Promise<X509Certificate> {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({
      host,
      port,
      servername: /^[\d.]+$|:/.test(host) ? undefined : host,
      rejectUnauthorized: false,
      timeout: 15_000,
    });
    socket.once('secureConnect', () => {
      const cert = socket.getPeerX509Certificate();
      socket.destroy();
      if (cert) resolve(cert);
      else reject(new Error('o servidor não apresentou certificado'));
    });
    socket.once('timeout', () => socket.destroy(new Error('tempo esgotado no TLS')));
    socket.once('error', reject);
  });
}

const issuedBy = (cert: X509Certificate, issuer: X509Certificate) =>
  cert.checkIssued(issuer) && cert.verify(issuer.publicKey);

/**
 * Baixa as intermediárias que faltam, seguindo o AIA a partir do certificado do site, até chegar
 * a um certificado assinado por uma das `roots`. Devolve as intermediárias em PEM, ou `[]` se a
 * cadeia não fecha numa raiz confiável (nesse caso nada é aceito).
 */
export async function missingIntermediates(
  leaf: X509Certificate,
  download: (url: string) => Promise<Buffer>,
  roots: readonly X509Certificate[],
): Promise<string[]> {
  const chain: X509Certificate[] = [];
  let current = leaf;
  for (let i = 0; i < MAX_INTERMEDIATES; i++) {
    if (roots.some((root) => issuedBy(current, root))) {
      return chain.map((cert) => cert.toString());
    }
    const url = caIssuerUrls(current)[0];
    if (!url) return [];
    let next: X509Certificate;
    try {
      next = new X509Certificate(await download(url));
    } catch {
      return []; // PKCS#7 ou conteúdo inválido: não dá para completar.
    }
    if (!issuedBy(current, next) || next.checkIssued(next)) return [];
    chain.push(next);
    current = next;
  }
  return roots.some((root) => issuedBy(current, root)) ? chain.map((c) => c.toString()) : [];
}

let systemRoots: X509Certificate[] | undefined;
/** Raízes confiáveis do Node (as mesmas que o fetch usa). */
export const defaultRoots = () =>
  (systemRoots ??= tls.rootCertificates.map((pem) => new X509Certificate(pem)));
