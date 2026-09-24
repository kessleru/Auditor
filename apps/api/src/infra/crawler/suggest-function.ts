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
  /** Não casa se algum destes termos aparecer (seleção de servidores, pesquisa etc.). */
  not?: readonly string[];
}[] = [
  {
    key: 'student_aid_notices',
    any: ['edital', 'editais', 'selecao', 'chamada publica', 'resultado', 'inscricoes'],
    with: [
      'auxilio',
      'auxilios',
      'assistencia estudantil',
      'assistenciaestudantil',
      'permanencia',
      'bolsa permanencia',
      'pnaes',
      'alimentacao',
      'moradia',
      'transporte estudantil',
    ],
    not: ['pesquisa', 'extensao', 'iniciacao cientifica', 'pibic', 'servidor', 'servidores'],
  },
  {
    key: 'admission',
    any: [
      'ingresso',
      'formas de ingresso',
      'como ingressar',
      'processo seletivo',
      'processos seletivos',
      'processoseletivo',
      'processosseletivos',
      'vestibular',
      'vestibulinho',
      'sisu',
      'exame de selecao',
      'exame classificatorio',
      'selecao de estudantes',
      'selecao discente',
      'inscricoes abertas',
      'seja nosso aluno',
      'seja nosso estudante',
      'estude no',
      'quero estudar',
    ],
    not: [
      'professor substituto',
      'professores substitutos',
      'docente',
      'docentes',
      'concurso',
      'concursos',
      'servidor',
      'servidores',
      'tecnico administrativo',
      'estagiario',
      'estagiarios',
      'bolsista',
      'bolsistas',
    ],
  },
  {
    key: 'accessibility_support',
    any: [
      'napne',
      'napnee',
      'napnes',
      'nucleo de acessibilidade',
      'coordenacao de acessibilidade',
      'necessidades especificas',
      'necessidades educacionais especificas',
      'educacao inclusiva',
      'atendimento educacional especializado',
      'nucleo de inclusao',
    ],
  },
  {
    key: 'student_support',
    any: [
      'assistencia estudantil',
      'assistenciaestudantil',
      'apoio ao estudante',
      'apoio ao discente',
      'atendimento ao estudante',
      'assistencia ao estudante',
      'assistencia ao educando',
      'coordenacao de assistencia',
      'auxilio estudantil',
      'politica de assistencia',
      'programa de assistencia',
      'pnaes',
      'cae',
      'nae',
      'servico social',
      'atendimento psicologico',
    ],
  },
  {
    key: 'library',
    any: ['biblioteca', 'bibliotecas', 'acervo', 'pergamum', 'sophia', 'repositorio institucional'],
  },
  {
    key: 'academic_calendar',
    any: [
      'calendario academico',
      'calendarios academicos',
      'calendario escolar',
      'calendarios escolares',
      'calendario letivo',
      'calendario de atividades academicas',
    ],
  },
  {
    key: 'class_schedule',
    any: [
      'horario de aula',
      'horario de aulas',
      'horarios de aula',
      'horarios de aulas',
      'horario das aulas',
      'horarios das aulas',
      'horario das turmas',
      'horarios das turmas',
      'quadro de horarios',
      'grade horaria',
    ],
  },
  {
    key: 'courses',
    any: [
      'cursos',
      'nossos cursos',
      'cursos ofertados',
      'oferta de cursos',
      'cursos tecnicos',
      'cursos superiores',
      'cursos de graduacao',
      'graduacao',
      'tecnico integrado',
    ],
    not: ['concurso', 'minicurso', 'minicursos', 'extensao', 'fic', 'eventos'],
  },
  {
    key: 'ombudsman',
    any: ['ouvidoria', 'fala br', 'falabr', 'e ouv'],
  },
  {
    key: 'information_access',
    any: [
      'acesso a informacao',
      'acessoainformacao',
      'acesso informacao',
      'lai',
      'sic',
      'e sic',
      'servico de informacao ao cidadao',
      'transparencia',
      'dados abertos',
    ],
  },
  {
    key: 'contact',
    any: [
      'contato',
      'contatos',
      'fale conosco',
      'faleconosco',
      'enderecos e telefones',
      'telefones',
    ],
  },
  {
    key: 'campuses',
    any: ['campi', 'nossos campi', 'conheca os campi', 'unidades', 'nossas unidades'],
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
  /**
   * Considera também o nome do host (ex.: `biblioteca.if.edu.br`), para subdomínios da
   * instituição. A raiz de um subdomínio não é `home`: `home` é só a raiz do portal.
   */
  includeHost?: boolean;
}

type Rule = (typeof FUNCTION_KEYWORDS)[number];

function matches(rule: Rule, text: string): boolean {
  const hasAny = rule.any.some((term) => containsTerm(text, term));
  const hasWith = !rule.with || rule.with.some((term) => containsTerm(text, term));
  const hasNot = rule.not?.some((term) => containsTerm(text, term)) ?? false;
  return hasAny && hasWith && !hasNot;
}

function parts({ url, title, linkText, includeHost }: SuggestionInput) {
  const { hostname, pathname, search } = new URL(url);
  const host = includeHost ? hostname.split('.').slice(0, -2).join(' ') : '';
  return {
    isRoot: pathname.replace(/\/+$/, '') === '' && search === '',
    path: toSearchText(`${host} ${decodeSafe(pathname)}`),
    title: toSearchText(title ?? ''),
    link: toSearchText(linkText ?? ''),
  };
}

/** Sugere a função da página, ou `null`. A raiz do site é sempre `home`. */
export function suggestFunction(input: SuggestionInput): PageFunctionKey | null {
  const p = parts(input);
  if (p.isRoot && !input.includeHost) return 'home';
  const text = [p.path, p.title, p.link].join(' ');
  // As exclusões valem para o texto todo: "Processo seletivo" no link de uma página cujo título
  // fala de professor substituto não é ingresso de estudante.
  return FUNCTION_KEYWORDS.find((rule) => matches(rule, text))?.key ?? null;
}

// Relevância da sugestão ---------------------------------------------------------------------

/** Caminhos típicos de conteúdo datado ou de listagem: raramente são a página da função. */
const EPHEMERAL_PATH =
  /(?:^|\/)(?:noticias?|news|posts?|blog|eventos?|agenda|tags?|categorias?|category|author|autor|page|pagina|arquivo|archive|comunicados?|avisos?)(?:\/|$)|\/(?:19|20)\d{2}\/\d{1,2}(?:\/|$)/i;

export interface RelevanceInput extends SuggestionInput {
  /** Link de menu (cabeçalho ou navegação) de alguma página visitada. */
  inNav?: boolean;
  /** Distância em links a partir da página inicial (1 = link da página inicial). */
  depth?: number;
}

/**
 * Relevância (0–100) da sugestão de função, para ordenar as candidatas na revisão e escolher o
 * que visitar primeiro quando o teto de URLs aperta. Não decide nada: só ordena o que o auditor vê.
 *
 * - termo da função no caminho da URL: +40; no título: +25; no texto do link: +25;
 * - link de menu: +15; link direto da página inicial: +10;
 * - caminho curto: +15 (1 nível), +10 (2), +5 (3);
 * - notícia, evento, listagem ou caminho com data: −35; parâmetros na URL: −10.
 */
export function suggestionRelevance(input: RelevanceInput): {
  functionKey: PageFunctionKey | null;
  relevance: number | null;
} {
  const functionKey = suggestFunction(input);
  if (functionKey === null) return { functionKey, relevance: null };
  if (functionKey === 'home') return { functionKey, relevance: 100 };

  const rule = FUNCTION_KEYWORDS.find((r) => r.key === functionKey) as Rule;
  const p = parts(input);
  const { pathname, search } = new URL(input.url);
  const segments = pathname.split('/').filter(Boolean).length;

  const terms = [...rule.any, ...(rule.with ?? [])];
  const has = (text: string) => terms.some((t) => containsTerm(text, t));

  let score = 0;
  if (has(p.path)) score += 40;
  if (has(p.title)) score += 25;
  if (has(p.link)) score += 25;
  if (input.inNav) score += 15;
  if (input.depth === 1) score += 10;
  score += segments <= 1 ? 15 : segments === 2 ? 10 : segments === 3 ? 5 : 0;
  if (EPHEMERAL_PATH.test(pathname)) score -= 35;
  if (search !== '') score -= 10;
  return { functionKey, relevance: Math.max(0, Math.min(100, score)) };
}

function decodeSafe(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
