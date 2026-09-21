import { describe, expect, it } from 'vitest';
import { isDevHost, isNavigable, isSameOrigin, isWithinDomain, normalizeUrl } from './url.js';

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
