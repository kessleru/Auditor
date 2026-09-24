import { describe, expect, it } from 'vitest';
import { suggestFunction, suggestionRelevance, toSearchText } from './suggest-function.js';

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

describe('exclusões e variações', () => {
  it.each([
    { url: `${base}/p/1`, title: 'Processo seletivo para professor substituto' },
    { url: `${base}/concursos/processo-seletivo-docentes` },
    { url: `${base}/p/2`, linkText: 'Seleção de bolsistas', title: 'Processo seletivo' },
    { url: `${base}/p/3`, title: 'Edital de bolsa de iniciação científica — auxílio' },
  ])('não sugere %o', (input) => {
    const fn = suggestFunction(input);
    expect(fn === 'admission' || fn === 'student_aid_notices').toBe(false);
  });

  it.each([
    [{ url: `${base}/processoseletivo` }, 'admission'],
    [{ url: `${base}/vestibulinho-2027` }, 'admission'],
    [
      { url: `${base}/p/1`, title: 'Resultado da seleção do auxílio estudantil' },
      'student_aid_notices',
    ],
    [{ url: `${base}/p/2`, linkText: 'Política de Assistência Estudantil' }, 'student_support'],
  ] as const)('%o → %s', (input, expected) => {
    expect(suggestFunction(input)).toBe(expected);
  });

  it('em subdomínio, usa o nome do host e a raiz não é home', () => {
    expect(suggestFunction({ url: 'https://biblioteca.if.edu.br', includeHost: true })).toBe(
      'library',
    );
    expect(suggestFunction({ url: 'https://suap.if.edu.br', includeHost: true })).toBeNull();
  });
});

describe('suggestionRelevance', () => {
  it('home vale 100; sem sugestão, null', () => {
    expect(suggestionRelevance({ url: base })).toEqual({ functionKey: 'home', relevance: 100 });
    expect(suggestionRelevance({ url: `${base}/sobre` })).toEqual({
      functionKey: null,
      relevance: null,
    });
  });

  it('ordena: menu curto > página interna > notícia datada', () => {
    const menu = suggestionRelevance({
      url: `${base}/biblioteca`,
      title: 'Biblioteca',
      linkText: 'Biblioteca',
      inNav: true,
      depth: 1,
    }).relevance as number;
    const inner = suggestionRelevance({
      url: `${base}/campus/uberaba/ensino/biblioteca`,
      title: 'Biblioteca do campus',
      depth: 2,
    }).relevance as number;
    const news = suggestionRelevance({
      url: `${base}/noticias/2026/05/biblioteca-amplia-horario`,
      title: 'Biblioteca amplia horário',
      depth: 2,
    }).relevance as number;
    expect(menu).toBe(100);
    expect(menu).toBeGreaterThan(inner);
    expect(inner).toBeGreaterThan(news);
    expect(news).toBeGreaterThanOrEqual(0);
  });
});

describe('toSearchText', () => {
  it('remove acentos e pontuação', () => {
    expect(toSearchText('Seleção—Ingresso/2027_1')).toBe('selecao ingresso 2027 1');
  });
});
