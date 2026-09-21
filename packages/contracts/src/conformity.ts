// Métrica de conformidade (seção 3.3; ADR 0003). Cobre apenas critérios verificáveis automaticamente.

/** Limiares da classificação, numa constante única. */
export const CONFORMITY_THRESHOLDS = { good: 0.75, partial: 0.5 } as const;

/** Problema presente em pelo menos esta fração das páginas avaliadas é de template. */
export const TEMPLATE_THRESHOLD = 0.8;

/** Com menos páginas avaliadas que isto, nenhum problema é marcado como template. */
export const TEMPLATE_MIN_PAGES = 2;

export const conformityClasses = ['good', 'partial', 'critical'] as const;
export type ConformityClass = (typeof conformityClasses)[number];

export function classifyConformity(conformity: number): ConformityClass {
  if (conformity >= CONFORMITY_THRESHOLDS.good) return 'good';
  if (conformity >= CONFORMITY_THRESHOLDS.partial) return 'partial';
  return 'critical';
}
