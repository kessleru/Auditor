import { describe, expect, it } from 'vitest';
import {
  isCrawlTrap,
  isDevHost,
  isNavigable,
  isSameOrigin,
  isWithinDomain,
  normalizeUrl,
  toCanonicalOrigin,
} from './url.js';

describe('normalizeUrl', () => {
  it.each([
    ['https://WWW.IF.edu.br/Ensino/', 'https://www.if.edu.br/Ensino'],
    ['https://www.if.edu.br/', 'https://www.if.edu.br'],
    ['https://www.if.edu.br', 'https://www.if.edu.br'],
    ['https://www.if.edu.br/a#secao', 'https://www.if.edu.br/a'],
    ['https://www.if.edu.br/a?utm_source=x&UTM_Medium=y&id=3', 'https://www.if.edu.br/a?id=3'],
    ['https://www.if.edu.br/a?fbclid=1&gclid=2', 'https://www.if.edu.br/a'],
    ['https://www.if.edu.br:443/a//', 'https://www.if.edu.br/a'],
    ['http://www.if.edu.br:80/a', 'http://www.if.edu.br/a'],
    ['https://user:senha@www.if.edu.br/a', 'https://www.if.edu.br/a'],
    ['https://www.if.edu.br/index.php', 'https://www.if.edu.br'],
    ['https://www.if.edu.br/ensino/Index.HTML', 'https://www.if.edu.br/ensino'],
    ['https://www.if.edu.br/a;jsessionid=AB12', 'https://www.if.edu.br/a'],
    ['https://www.if.edu.br/a?PHPSESSID=1&id=2', 'https://www.if.edu.br/a?id=2'],
    ['https://www.if.edu.br/a?b=2&a=1', 'https://www.if.edu.br/a?a=1&b=2'],
    [
      'https://www.if.edu.br/index.php?option=com_content&id=5',
      'https://www.if.edu.br?id=5&option=com_content',
    ],
  ])('%s → %s', (input, expected) => {
    expect(normalizeUrl(input)).toBe(expected);
  });

  it('resolve URLs relativas', () => {
    expect(normalizeUrl('../cursos/', 'https://www.if.edu.br/ensino/pagina')).toBe(
      'https://www.if.edu.br/cursos',
    );
    expect(normalizeUrl('?pagina=2', 'https://www.if.edu.br/noticias')).toBe(
      'https://www.if.edu.br/noticias?pagina=2',
    );
  });

  it.each([
    'mailto:a@if.edu.br',
    'javascript:void(0)',
    'tel:+5534',
    'ftp://if.edu.br/a',
    'http://',
  ])('rejeita %s', (input) => {
    expect(normalizeUrl(input, 'https://www.if.edu.br')).toBeNull();
  });
});

describe('isNavigable', () => {
  it.each(['edital.pdf', 'planilha.XLSX', 'foto.jpeg', 'video.mp4', 'arquivos.zip', 'doc.docx'])(
    'ignora %s',
    (file) => {
      expect(isNavigable(`https://www.if.edu.br/arquivos/${file}`)).toBe(false);
    },
  );

  it.each(['/ensino', '/pagina.html', '/index.php', '/noticias/2026.01', '/'])(
    'aceita %s',
    (path) => {
      expect(isNavigable(`https://www.if.edu.br${path}`)).toBe(true);
    },
  );
});

describe('origem e domínio', () => {
  it('compara origem por protocolo, host e porta', () => {
    expect(isSameOrigin('https://www.if.edu.br/a', 'https://www.if.edu.br')).toBe(true);
    expect(isSameOrigin('http://www.if.edu.br/a', 'https://www.if.edu.br')).toBe(false);
    expect(isSameOrigin('https://campus.if.edu.br/a', 'https://www.if.edu.br')).toBe(false);
  });

  it('reconhece subdomínios da instituição', () => {
    expect(isWithinDomain('campus.if.edu.br', 'if.edu.br')).toBe(true);
    expect(isWithinDomain('naoif.edu.br', 'if.edu.br')).toBe(false);
  });

  it.each([
    'dev.if.edu.br',
    'hml.if.edu.br',
    'homolog.if.edu.br',
    'staging.if.edu.br',
    'portal.hml.if.edu.br',
  ])('marca %s como homologação', (host) => {
    expect(isDevHost(host)).toBe(true);
  });

  it.each(['www.if.edu.br', 'devolucao.if.edu.br', 'if.edu.br'])('não marca %s', (host) => {
    expect(isDevHost(host)).toBe(false);
  });
});

describe('toCanonicalOrigin', () => {
  const origin = 'https://www.if.edu.br';

  it.each([
    ['https://if.edu.br/a?x=1', 'https://www.if.edu.br/a?x=1'],
    ['http://www.if.edu.br/a', 'https://www.if.edu.br/a'],
    ['http://if.edu.br', 'https://www.if.edu.br'],
    ['https://www.if.edu.br/a', 'https://www.if.edu.br/a'],
  ])('%s → %s', (input, expected) => {
    expect(toCanonicalOrigin(input, origin)).toBe(expected);
  });

  it('não mexe em outro host nem em outra porta', () => {
    expect(toCanonicalOrigin('https://campus.if.edu.br/a', origin)).toBe(
      'https://campus.if.edu.br/a',
    );
    expect(toCanonicalOrigin('https://if.edu.br:8443/a', origin)).toBe('https://if.edu.br:8443/a');
  });
});

describe('isCrawlTrap', () => {
  it.each([
    '/?s=edital',
    '/busca?termo=x',
    '/feed',
    '/noticias/feed/',
    '/wp-json/wp/v2/posts',
    '/a?print=1',
    '/a?tmpl=component',
    '/@@search?SearchableText=x',
  ])('marca %s', (path) => {
    expect(isCrawlTrap(`https://www.if.edu.br${path}`)).toBe(true);
  });

  it.each(['/pesquisa', '/ingresso', '/noticias?pagina=2', '/feedback'])('não marca %s', (path) => {
    expect(isCrawlTrap(`https://www.if.edu.br${path}`)).toBe(false);
  });
});
