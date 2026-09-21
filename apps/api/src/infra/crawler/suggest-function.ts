import type { PageFunctionKey } from '@auditoria-rf/contracts';

// Palavras-chave para sugerir a função da página (seção 3.1.4). Comparadas sem acento e sem
// diferenciar maiúsculas, como sequência de palavras inteiras, no título, na URL e no texto do link.
// A ordem importa: vale a primeira função que casar. A sugestão nunca é aplicada sem o auditor.
export const FUNCTION_KEYWORDS: readonly {
  key: Exclude<PageFunctionKey, 'home'>;
  /** Casa se algum termo aparecer. */
  any: readonly string[];
  /** Se presente, exige também um destes termos. */
  with?: readonly string[];
}[] = [
  {
    key: 'student_aid_notices',
    any: ['edital', 'editais'],
    with: [
      'auxilio',
      'auxilios',
      'assistencia estudantil',
      'permanencia',
      'bolsa',
      'bolsas',
      'pnaes',
      'alimentacao',
      'moradia',
      'transporte estudantil',
    ],
  },
  {
    key: 'admission',
    any: [
      'ingresso',
      'formas de ingresso',
      'como ingressar',
      'processo seletivo',
      'processos seletivos',
      'vestibular',
      'sisu',
      'exame de selecao',
      'selecao de estudantes',
      'selecao discente',
      'inscricoes abertas',
      'seja nosso aluno',
      'seja nosso estudante',
      'estude no',
    ],
  },
  {
    key: 'student_support',
    any: [
      'assistencia estudantil',
      'apoio ao estudante',
      'atendimento ao estudante',
      'assistencia ao estudante',
      'coordenacao de assistencia',
      'pnaes',
      'cae',
      'nae',
      'napne',
      'servico social',
      'atendimento psicologico',
    ],
  },
  {
    key: 'library',
    any: ['biblioteca', 'bibliotecas', 'acervo', 'pergamum', 'sophia', 'repositorio institucional'],
  },
];

/** Minúsculas, sem acentos, com qualquer sequência de não alfanuméricos virando um espaço. */
export function toSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const containsTerm = (text: string, term: string) => ` ${text} `.includes(` ${term} `);

export interface SuggestionInput {
  url: string;
  title?: string | undefined;
  linkText?: string | undefined;
}

/** Sugere a função da página, ou `null`. A raiz do site é sempre `home`. */
export function suggestFunction({ url, title, linkText }: SuggestionInput): PageFunctionKey | null {
  const { pathname, search } = new URL(url);
  if (pathname.replace(/\/+$/, '') === '' && search === '') return 'home';

  const text = toSearchText([decodeSafe(pathname), title ?? '', linkText ?? ''].join(' '));
  for (const rule of FUNCTION_KEYWORDS) {
    const hasAny = rule.any.some((term) => containsTerm(text, term));
    const hasWith = !rule.with || rule.with.some((term) => containsTerm(text, term));
    if (hasAny && hasWith) return rule.key;
  }
  return null;
}

function decodeSafe(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
