import * as cheerio from 'cheerio';

export interface PageLink {
  href: string;
  text: string;
}

export interface ParsedPage {
  title: string | undefined;
  links: PageLink[];
  hasPasswordField: boolean;
  /** `<base href>` da página, se houver; links relativos resolvem a partir dela. */
  baseHref: string | undefined;
}

const collapse = (value: string) => value.replace(/\s+/g, ' ').trim();

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
      collapse($el.attr('title') ?? '');
    links.push({ href, text });
  });

  return {
    title: collapse($('title').first().text()) || undefined,
    links,
    hasPasswordField: $('input[type="password" i]').length > 0,
    baseHref: $('base[href]').first().attr('href'),
  };
}
