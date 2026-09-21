import { gunzipSync } from 'node:zlib';
import { XMLParser } from 'fast-xml-parser';

export type ParsedSitemap =
  { kind: 'urlset'; urls: string[] } | { kind: 'index'; sitemaps: string[] } | { kind: 'invalid' };

const parser = new XMLParser({
  removeNSPrefix: true,
  parseTagValue: false,
  ignoreAttributes: true,
});

const toArray = <T>(value: T | T[] | undefined): T[] =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];

function locs(entries: unknown): string[] {
  return toArray(entries as { loc?: unknown } | { loc?: unknown }[])
    .map((entry) => (typeof entry?.loc === 'string' ? entry.loc.trim() : ''))
    .filter((loc) => loc.length > 0);
}

/** Descomprime se o conteúdo for gzip (pelo número mágico, não pela extensão). */
export function decodeSitemapBody(body: Buffer): string {
  const isGzip = body.length > 2 && body[0] === 0x1f && body[1] === 0x8b;
  return (isGzip ? gunzipSync(body) : body).toString('utf8');
}

export function parseSitemap(xml: string): ParsedSitemap {
  let doc: Record<string, unknown>;
  try {
    doc = parser.parse(xml) as Record<string, unknown>;
  } catch {
    return { kind: 'invalid' };
  }

  const urlset = doc['urlset'] as { url?: unknown } | undefined;
  if (urlset !== undefined) return { kind: 'urlset', urls: locs(urlset?.url) };

  const index = doc['sitemapindex'] as { sitemap?: unknown } | undefined;
  if (index !== undefined) return { kind: 'index', sitemaps: locs(index?.sitemap) };

  return { kind: 'invalid' };
}
