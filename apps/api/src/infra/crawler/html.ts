import * as cheerio from 'cheerio';

export interface PageLink {
  href: string;
  text: string;
  /** Link de menu (dentro de `nav`, `header` ou `role="navigation"`): indica página de destaque. */
  inNav: boolean;
}

export interface ParsedPage {
  title: string | undefined;
  links: PageLink[];
  hasPasswordField: boolean;
  /** `<base href>` da página, se houver; links relativos resolvem a partir dela. */
  baseHref: string | undefined;
}

const collapse = (value: string) => value.replace(/\s+/g, ' ').trim();

const NAV_SELECTOR = 'nav, header, [role="navigation" i], [role="banner" i]';

/**
 * Decodifica o HTML pela codificação declarada (cabeçalho `content-type` ou `<meta charset>`).
 * Portais antigos ainda servem ISO-8859-1: ler como UTF-8 estragaria os acentos, e com eles as
 * palavras-chave da sugestão ("Assistência" viraria "Assist�ncia").
 */
export function decodeHtml(body: Buffer, contentType = ''): string {
  const head = body.subarray(0, 2048).toString('latin1');
  const declared =
    /charset\s*=\s*["']?([\w-]+)/i.exec(contentType)?.[1] ??
    /<meta[^>]+charset\s*=\s*["']?([\w-]+)/i.exec(head)?.[1];
  if (declared) {
    try {
      return new TextDecoder(declared.toLowerCase()).decode(body);
    } catch {
      // Codificação desconhecida: segue como UTF-8.
    }
  }
  return new TextDecoder('utf-8').decode(body);
}

export function parseHtml(html: string): ParsedPage {
  const $ = cheerio.load(html);

  const links: PageLink[] = [];
  $('a[href]').each((_, el) => {
    const $el = $(el);
    const href = $el.attr('href');
    if (!href) return;
    const text =
      collapse($el.text()) ||
      collapse($el.attr('aria-label') ?? '') ||
      collapse($el.attr('title') ?? '') ||
      collapse($el.find('img[alt]').first().attr('alt') ?? '');
    links.push({ href, text, inNav: $el.closest(NAV_SELECTOR).length > 0 });
  });

  return {
    title: collapse($('title').first().text()) || undefined,
    links,
    hasPasswordField: $('input[type="password" i]').length > 0,
    baseHref: $('base[href]').first().attr('href'),
  };
}
