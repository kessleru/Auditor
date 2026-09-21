// Regras de URL da descoberta de rotas (seção 3.1.3 e 3.1.6 do plano).

const TRACKING_PARAMS = new Set(['fbclid', 'gclid']);

// Arquivos não navegáveis: documentos, planilhas, apresentações, imagens, áudio, vídeo e compactados.
const NON_NAVIGABLE_EXTENSIONS = new Set([
  'pdf',
  'doc',
  'docx',
  'odt',
  'rtf',
  'xls',
  'xlsx',
  'ods',
  'csv',
  'ppt',
  'pptx',
  'odp',
  'jpg',
  'jpeg',
  'png',
  'gif',
  'svg',
  'webp',
  'bmp',
  'ico',
  'tif',
  'tiff',
  'mp3',
  'wav',
  'ogg',
  'mp4',
  'avi',
  'mov',
  'wmv',
  'webm',
  'mkv',
  'flv',
  'zip',
  'rar',
  '7z',
  'tar',
  'gz',
  'tgz',
  'xml',
  'json',
  'txt',
  'exe',
  'msi',
  'apk',
  'iso',
]);

export const DEV_HOST_REASON = 'Domínio de desenvolvimento ou homologação.';

/**
 * Normaliza uma URL para deduplicação: resolve relativa a `base`, aceita só http(s), remove
 * fragmento, parâmetros de rastreio (`utm_*`, `fbclid`, `gclid`), porta padrão e barra final,
 * e põe o host em minúsculas. Retorna `null` se a URL for inválida ou não for http(s).
 */
export function normalizeUrl(input: string, base?: string): string | null {
  let url: URL;
  try {
    url = new URL(input.trim(), base);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

  url.hash = '';
  url.username = '';
  url.password = '';
  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase().startsWith('utm_') || TRACKING_PARAMS.has(key.toLowerCase())) {
      url.searchParams.delete(key);
    }
  }
  // O construtor de URL já põe o host em minúsculas e remove a porta padrão.
  const pathname = url.pathname.replace(/\/+$/, '');
  const search = url.searchParams.size > 0 ? `?${url.searchParams.toString()}` : '';
  return `${url.protocol}//${url.host}${pathname}${search}`;
}

export function isNavigable(url: string): boolean {
  const { pathname } = new URL(url);
  const lastSegment = pathname.slice(pathname.lastIndexOf('/') + 1);
  const dot = lastSegment.lastIndexOf('.');
  if (dot === -1) return true;
  return !NON_NAVIGABLE_EXTENSIONS.has(lastSegment.slice(dot + 1).toLowerCase());
}

export function isSameOrigin(url: string, origin: string): boolean {
  return new URL(url).origin === origin;
}

export { isDevHost } from '@auditoria-rf/contracts';

/** Host pertence ao domínio da instituição (o próprio domínio ou um subdomínio dele). */
export function isWithinDomain(host: string, domain: string): boolean {
  const h = host.toLowerCase();
  const d = domain.toLowerCase();
  return h === d || h.endsWith(`.${d}`);
}
