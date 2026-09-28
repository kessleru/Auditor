// Valores de domínio compartilhados entre o banco (api) e a interface (web).
// Modelo de dados: seção 2 do plano.

export const pageFunctionKeys = [
  'home',
  'admission',
  'student_aid_notices',
  'library',
  'student_support',
  // Ampliação decidida com o autor (ADR 0013): páginas essenciais para estudantes.
  'courses',
  'academic_calendar',
  'class_schedule',
  'contact',
  'ombudsman',
  'information_access',
  'accessibility_support',
  'campuses',
] as const;
export type PageFunctionKey = (typeof pageFunctionKeys)[number];

/** Rótulos das funções de página na interface (também gravados em `page_functions`). */
export const pageFunctionLabels: Record<PageFunctionKey, string> = {
  home: 'Página inicial',
  admission: 'Ingresso',
  student_aid_notices: 'Editais de auxílio estudantil',
  library: 'Biblioteca',
  student_support: 'Assistência estudantil',
  courses: 'Cursos ofertados',
  academic_calendar: 'Calendário acadêmico',
  class_schedule: 'Horários de aula',
  contact: 'Contato',
  ombudsman: 'Ouvidoria',
  information_access: 'Acesso à informação',
  accessibility_support: 'Núcleo de acessibilidade (NAPNE)',
  campuses: 'Campi e unidades',
};

export const routeSources = ['sitemap', 'crawler', 'manual'] as const;
export type RouteSource = (typeof routeSources)[number];

export const routeStatuses = ['suggested', 'confirmed', 'excluded', 'authenticated'] as const;
export type RouteStatus = (typeof routeStatuses)[number];

export const collectionStatuses = [
  'queued',
  'running',
  'completed',
  'partial',
  'cancelled',
] as const;
export type CollectionStatus = (typeof collectionStatuses)[number];

export const collectionPageStatuses = ['queued', 'running', 'done', 'failed'] as const;
export type CollectionPageStatus = (typeof collectionPageStatuses)[number];

/**
 * Motivo de uma página que não pôde ser auditada, agrupado para o relatório de confiabilidade da
 * coleta (limitações do estudo). `timeout` é a página que não terminou de carregar no tempo da
 * coleta; `network`, o servidor inacessível (DNS, conexão, certificado); `off_domain`, o
 * redirecionamento para fora do domínio (ADR 0016); `tool`, falha da própria ferramenta.
 */
export const pageFailureKinds = [
  'timeout',
  'http',
  'off_domain',
  'network',
  'not_html',
  'tool',
  'other',
] as const;
export type PageFailureKind = (typeof pageFailureKinds)[number];

export const pageFailureKindLabels: Record<PageFailureKind, string> = {
  timeout: 'Tempo esgotado',
  http: 'Erro HTTP',
  off_domain: 'Fora do domínio (proteção contra robôs)',
  network: 'Servidor inacessível',
  not_html: 'Não é página HTML',
  tool: 'Falha da ferramenta',
  other: 'Outro motivo',
};

export const wcagPrinciples = ['perceivable', 'operable', 'understandable', 'robust'] as const;
export type WcagPrinciple = (typeof wcagPrinciples)[number];

export const axeImpacts = ['critical', 'serious', 'moderate', 'minor'] as const;
export type AxeImpact = (typeof axeImpacts)[number];

// critical/serious → Crítico; moderate/minor → Moderado (seção 3.2.7).
export const severities = ['critical', 'moderate'] as const;
export type Severity = (typeof severities)[number];

export const findingValidations = ['pending', 'confirmed', 'false_positive'] as const;
export type FindingValidation = (typeof findingValidations)[number];

export const taskResults = ['completed', 'completed_with_difficulty', 'interrupted'] as const;
export type TaskResult = (typeof taskResults)[number];

// Heurísticas de Nielsen priorizadas (seção 3.4).
export const heuristics = ['H1', 'H2', 'H3', 'H4', 'H6'] as const;
export type Heuristic = (typeof heuristics)[number];

export const assistiveCheckKinds = [
  'keyboard',
  'screen_reader',
  'zoom_200',
  'captions',
  'contrast',
] as const;
export type AssistiveCheckKind = (typeof assistiveCheckKinds)[number];

export const assistiveCheckStates = ['pass', 'barrier', 'not_applicable', 'pending'] as const;
export type AssistiveCheckState = (typeof assistiveCheckStates)[number];
