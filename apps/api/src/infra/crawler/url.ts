// Regras de URL da descoberta de rotas (seção 3.1.3 e 3.1.6 do plano).

// Rastreio e sessão: não mudam o conteúdo e multiplicariam a mesma página.
const TRACKING_PARAMS = new Set([
  'fbclid',
  'gclid',
  'msclkid',
  '_ga',
  'mc_cid',
  'mc_eid',
  'phpsessid',
  'jsessionid',
  'sessionid',
]);

/** Página de índice explícita: `/ensino/index.php` é a mesma página que `/ensino`. */
const INDEX_FILE = /\/index\.(?:html?|php|jsp|aspx?)$/i;

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
 * fragmento, parâmetros de rastreio e de sessão (`utm_*`, `fbclid`, `gclid`, `jsessionid`...),
 * porta padrão, barra final e `index.html`/`index.php` no fim do caminho, ordena os parâmetros e
 * põe o host em minúsculas. Retorna `null` se a URL for inválida ou não for http(s).
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
  // Ordem dos parâmetros não muda a página: `?b=1&a=2` e `?a=2&b=1` são a mesma URL.
  url.searchParams.sort();
  // O construtor de URL já põe o host em minúsculas e remove a porta padrão. Sessão na URL
  // (`;jsessionid=...`) e página de índice explícita saem do caminho.
  const pathname = url.pathname
    .replace(/;jsessionid=[^/]*$/i, '')
    .replace(INDEX_FILE, '')
    .replace(/\/+$/, '');
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

/**
 * Mesmo site com outro endereço: `http://` ou com/sem `www.` em relação à origem canônica do
 * portal. Devolve a URL reescrita para a origem canônica, ou a própria URL se não for o caso.
 * Sem isso, um menu com links absolutos para `iftm.edu.br` seria descartado quando o portal
 * responde em `www.iftm.edu.br`.
 */
export function toCanonicalOrigin(url: string, origin: string): string {
  const target = new URL(url);
  const canonical = new URL(origin);
  const bare = (host: string) => host.replace(/^www\./, '');
  if (target.origin === canonical.origin) return url;
  if (bare(target.host) !== bare(canonical.host)) return url;
  if (target.port !== canonical.port && target.port !== '') return url;
  return `${canonical.origin}${url.slice(target.origin.length)}`;
}

// Armadilhas de rastreamento: páginas sem valor para a pesquisa que consumiriam o teto de URLs
// (resultados de busca, feeds, versões de impressão, APIs e painéis do CMS, compartilhamento).
const TRAP_PATH =
  /(?:^|\/)(?:feed|rss|atom|wp-json|wp-admin|xmlrpc\.php|busca|search|@@search|print|imprimir)(?:\/|$)/i;
const TRAP_PARAMS = new Set([
  's',
  'q',
  'searchword',
  'search',
  'busca',
  'print',
  'format',
  'tmpl',
  'replytocom',
  'share',
  'ical',
  'outlook-ical',
]);

export function isCrawlTrap(url: string): boolean {
  const { pathname, searchParams } = new URL(url);
  if (TRAP_PATH.test(pathname)) return true;
  return [...searchParams.keys()].some((key) => TRAP_PARAMS.has(key.toLowerCase()));
}
