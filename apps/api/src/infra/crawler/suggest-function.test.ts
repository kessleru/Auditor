import { describe, expect, it } from 'vitest';
import { suggestFunction, toSearchText } from './suggest-function.js';

const base = 'https://www.if.edu.br';

describe('suggestFunction', () => {
  it('sugere home só para a raiz', () => {
    expect(suggestFunction({ url: `${base}` })).toBe('home');
    expect(suggestFunction({ url: `${base}/` })).toBe('home');
    expect(suggestFunction({ url: `${base}/?lang=en` })).toBeNull();
  });

  it.each([
    [{ url: `${base}/ingresso` }, 'admission'],
    [{ url: `${base}/p/123`, title: 'Processo Seletivo 2027/1' }, 'admission'],
    [{ url: `${base}/p/1`, linkText: 'Vestibular' }, 'admission'],
    [{ url: `${base}/editais-de-auxilio-estudantil` }, 'student_aid_notices'],
    [{ url: `${base}/p/2`, title: 'Edital nº 12 – Auxílio Permanência' }, 'student_aid_notices'],
    [{ url: `${base}/assistencia-estudantil` }, 'student_support'],
    [
      { url: `${base}/p/3`, linkText: 'CAE - Coordenação de Assistência ao Educando' },
      'student_support',
    ],
    [{ url: `${base}/biblioteca` }, 'library'],
    [{ url: `${base}/p/4`, title: 'Acervo das Bibliotecas' }, 'library'],
  ] as const)('%o → %s', (input, expected) => {
    expect(suggestFunction(input)).toBe(expected);
  });

  it('edital sem termo de auxílio não é edital de auxílio', () => {
    expect(suggestFunction({ url: `${base}/editais`, title: 'Editais de pesquisa' })).toBeNull();
  });

  it('prioriza editais de auxílio sobre assistência estudantil', () => {
    expect(suggestFunction({ url: `${base}/assistencia-estudantil/editais` })).toBe(
      'student_aid_notices',
    );
  });

  it('casa só palavras inteiras', () => {
    expect(suggestFunction({ url: `${base}/caes-e-gatos` })).toBeNull();
    expect(suggestFunction({ url: `${base}/p/9`, title: 'Ingressos para o show' })).toBeNull();
  });

  it('ignora a parte da URL que é domínio', () => {
    expect(suggestFunction({ url: 'https://biblioteca.if.edu.br/noticias' })).toBeNull();
  });
});

describe('toSearchText', () => {
  it('remove acentos e pontuação', () => {
    expect(toSearchText('Seleção—Ingresso/2027_1')).toBe('selecao ingresso 2027 1');
  });
});
