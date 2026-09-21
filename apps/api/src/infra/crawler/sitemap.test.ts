import { describe, expect, it } from 'vitest';
import { decodeSitemapBody, parseSitemap } from './sitemap.js';
import { fixture, gz } from './__fixtures__/site.js';

describe('parseSitemap', () => {
  it('lê um urlset, com espaços, entidades e namespaces extras', () => {
    const parsed = parseSitemap(fixture('sitemap-paginas.xml'));
    expect(parsed.kind).toBe('urlset');
    if (parsed.kind !== 'urlset') return;
    expect(parsed.urls).toHaveLength(7);
    expect(parsed.urls).toContain('https://www.if.edu.br/institucional/sobre');
    expect(parsed.urls).toContain(
      'https://www.if.edu.br/ingresso?utm_source=sitemap&utm_medium=xml',
    );
  });

  it('lê um sitemap index', () => {
    expect(parseSitemap(fixture('sitemap_index.xml'))).toEqual({
      kind: 'index',
      sitemaps: [
        'https://www.if.edu.br/sitemap-paginas.xml',
        'https://www.if.edu.br/sitemap-noticias.xml.gz',
      ],
    });
  });

  it('lê um urlset com uma única URL', () => {
    const xml = '<urlset><url><loc>https://www.if.edu.br/a</loc></url></urlset>';
    expect(parseSitemap(xml)).toEqual({ kind: 'urlset', urls: ['https://www.if.edu.br/a'] });
  });

  it.each(['<html><body>Página de erro</body></html>', 'não é xml', ''])('rejeita %j', (xml) => {
    expect(parseSitemap(xml).kind).toBe('invalid');
  });
});

describe('decodeSitemapBody', () => {
  it('descomprime gzip pelo conteúdo', () => {
    const xml = fixture('sitemap-noticias.xml');
    expect(decodeSitemapBody(gz(xml))).toBe(xml);
    expect(decodeSitemapBody(Buffer.from(xml))).toBe(xml);
  });
});
