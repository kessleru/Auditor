import { describe, expect, it } from 'vitest';
import { decodeHtml, parseHtml } from './html.js';

describe('parseHtml', () => {
  it('extrai título, links e texto acessível dos links', () => {
    const page = parseHtml(`
      <html><head><title>  Início |
        IF  </title><base href="/portal/"></head>
      <body>
        <nav><ul><li><a href="/ingresso">  Processo
          seletivo </a></li></ul></nav>
        <a href="/busca" aria-label="Buscar no portal"><svg></svg></a>
        <a href="/x" title="Título do link"></a>
        <header><a href="/biblioteca"><img src="b.png" alt="Biblioteca"></a></header>
        <a>sem href</a>
      </body></html>`);

    expect(page.title).toBe('Início | IF');
    expect(page.baseHref).toBe('/portal/');
    expect(page.links).toEqual([
      { href: '/ingresso', text: 'Processo seletivo', inNav: true },
      { href: '/busca', text: 'Buscar no portal', inNav: false },
      { href: '/x', text: 'Título do link', inNav: false },
      { href: '/biblioteca', text: 'Biblioteca', inNav: true },
    ]);
    expect(page.hasPasswordField).toBe(false);
  });

  it('detecta campo de senha', () => {
    expect(parseHtml('<form><input type="PASSWORD" name="s"></form>').hasPasswordField).toBe(true);
  });
});

describe('decodeHtml', () => {
  const latin1 = Buffer.from('<title>Assistência Estudantil</title>', 'latin1');

  it('usa o charset do cabeçalho', () => {
    expect(decodeHtml(latin1, 'text/html; charset=ISO-8859-1')).toContain('Assistência');
  });

  it('usa o <meta charset> quando o cabeçalho não declara', () => {
    const body = Buffer.concat([Buffer.from('<meta charset="windows-1252">'), latin1]);
    expect(decodeHtml(body, 'text/html')).toContain('Assistência');
  });

  it('sem declaração, lê como UTF-8; codificação desconhecida também', () => {
    const utf8 = Buffer.from('<p>Seleção</p>');
    expect(decodeHtml(utf8)).toBe('<p>Seleção</p>');
    expect(decodeHtml(utf8, 'text/html; charset=inexistente')).toBe('<p>Seleção</p>');
  });
});
