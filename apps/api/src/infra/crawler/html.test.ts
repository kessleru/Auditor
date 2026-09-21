import { describe, expect, it } from 'vitest';
import { parseHtml } from './html.js';

describe('parseHtml', () => {
  it('extrai título, links e texto acessível dos links', () => {
    const page = parseHtml(`
      <html><head><title>  Início |
        IF  </title><base href="/portal/"></head>
      <body>
        <a href="/ingresso">  Processo
          seletivo </a>
        <a href="/busca" aria-label="Buscar no portal"><svg></svg></a>
        <a href="/x" title="Título do link"></a>
        <a>sem href</a>
      </body></html>`);

    expect(page.title).toBe('Início | IF');
    expect(page.baseHref).toBe('/portal/');
    expect(page.links).toEqual([
      { href: '/ingresso', text: 'Processo seletivo' },
      { href: '/busca', text: 'Buscar no portal' },
      { href: '/x', text: 'Título do link' },
    ]);
    expect(page.hasPasswordField).toBe(false);
  });

  it('detecta campo de senha', () => {
    expect(parseHtml('<form><input type="PASSWORD" name="s"></form>').hasPasswordField).toBe(true);
  });
});
