import { describe, expect, it } from 'vitest';
import { analyzeFingerprints, withoutPosition } from './fingerprint-analysis.js';

const f = (pageId: number, ruleId: string, selector: string, htmlSnippet: string) => ({
  pageId,
  ruleId,
  selector,
  htmlSnippet,
});

describe('analyzeFingerprints', () => {
  it('mede um problema de template partido por nth-child', () => {
    // O mesmo link do menu aparece em posições diferentes em cada página.
    const findings = [
      f(1, 'link-name', 'nav > li:nth-child(3) > a', '<a href="/busca"></a>'),
      f(2, 'link-name', 'nav > li:nth-child(4) > a', '<a href="/busca"></a>'),
      f(3, 'link-name', 'nav > li:nth-child(4) > a', '<a  href="/busca"></a>'),
    ];
    const result = analyzeFingerprints(findings, 3);
    expect(result.byKey.selector).toEqual({ distinct: 2, template: 0 });
    expect(result.byKey.selectorWithoutPosition).toEqual({ distinct: 1, template: 1 });
    expect(result.byKey.html).toEqual({ distinct: 1, template: 1 });
    expect(result.split).toEqual([
      {
        ruleId: 'link-name',
        html: '<a href="/busca"></a>',
        selectors: ['nav > li:nth-child(3) > a', 'nav > li:nth-child(4) > a'],
      },
    ]);
  });

  it('mede elementos diferentes juntados por um seletor genérico', () => {
    const findings = [
      f(1, 'color-contrast', 'p', '<p class="aviso">Inscrições</p>'),
      f(2, 'color-contrast', 'p', '<p class="rodape">Endereço</p>'),
    ];
    const result = analyzeFingerprints(findings, 2);
    expect(result.byKey.selector).toEqual({ distinct: 1, template: 1 });
    expect(result.byKey.html).toEqual({ distinct: 2, template: 0 });
    expect(result.merged).toEqual([
      {
        ruleId: 'color-contrast',
        selector: 'p',
        htmls: ['<p class="aviso">Inscrições</p>', '<p class="rodape">Endereço</p>'],
      },
    ]);
  });

  it('com uma página só, nada é de template', () => {
    expect(analyzeFingerprints([f(1, 'label', '#q', '<input id="q">')], 1).byKey.selector).toEqual({
      distinct: 1,
      template: 0,
    });
  });
});

describe('withoutPosition', () => {
  it('tira nth-child, nth-of-type e as variações last', () => {
    expect(
      withoutPosition('ul > li:nth-child(2n+1) > a:nth-of-type(1), li:nth-last-child(2)'),
    ).toBe('ul > li > a, li');
  });
});
