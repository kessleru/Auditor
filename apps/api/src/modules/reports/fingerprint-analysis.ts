import { TEMPLATE_MIN_PAGES, TEMPLATE_THRESHOLD } from '@auditoria-rf/contracts';

// Análise do agrupamento de problemas (ADR 0003): o `fingerprint` atual é regra + seletor. Este
// relatório só mede, sem mudar nada, quanto o número de problemas distintos e de template muda
// com outras chaves, para o autor decidir se o agrupamento precisa de ajuste.

export interface AnalysisFinding {
  pageId: number;
  ruleId: string;
  selector: string;
  htmlSnippet: string;
}

export const groupingKeys = ['selector', 'selectorWithoutPosition', 'html'] as const;
export type GroupingKey = (typeof groupingKeys)[number];

/** Seletor sem posição (`:nth-child(3)`, `:nth-of-type(2)`), que muda de uma página para outra. */
export const withoutPosition = (selector: string) =>
  selector.replace(/:nth-(?:last-)?(?:child|of-type)\([^)]*\)/g, '');

/** HTML do elemento com espaços normalizados. */
export const normalizedHtml = (html: string) => html.replace(/\s+/g, ' ').trim();

const keyOf: Record<GroupingKey, (f: AnalysisFinding) => string> = {
  selector: (f) => `${f.ruleId}\n${f.selector}`,
  selectorWithoutPosition: (f) => `${f.ruleId}\n${withoutPosition(f.selector)}`,
  html: (f) => `${f.ruleId}\n${normalizedHtml(f.htmlSnippet)}`,
};

export interface GroupingSummary {
  distinct: number;
  template: number;
}

export interface FingerprintAnalysis {
  pagesEvaluated: number;
  byKey: Record<GroupingKey, GroupingSummary>;
  /** Mesmo elemento (regra + HTML) com seletores diferentes: um problema partido em vários. */
  split: { ruleId: string; html: string; selectors: string[] }[];
  /** Mesma regra + seletor com HTML diferente: elementos diferentes contados como um. */
  merged: { ruleId: string; selector: string; htmls: string[] }[];
}

/** Compara as chaves de agrupamento nas páginas avaliadas de uma instituição numa coleta. */
export function analyzeFingerprints(
  findings: readonly AnalysisFinding[],
  pagesEvaluated: number,
): FingerprintAnalysis {
  const summarize = (key: GroupingKey): GroupingSummary => {
    const pages = new Map<string, Set<number>>();
    for (const f of findings) {
      const k = keyOf[key](f);
      pages.set(k, (pages.get(k) ?? new Set()).add(f.pageId));
    }
    const template =
      pagesEvaluated < TEMPLATE_MIN_PAGES
        ? 0
        : [...pages.values()].filter((p) => p.size / pagesEvaluated >= TEMPLATE_THRESHOLD).length;
    return { distinct: pages.size, template };
  };

  const collect = (
    group: (f: AnalysisFinding) => string,
    value: (f: AnalysisFinding) => string,
  ) => {
    const map = new Map<string, { first: AnalysisFinding; values: Set<string> }>();
    for (const f of findings) {
      const g = group(f);
      const entry = map.get(g) ?? { first: f, values: new Set<string>() };
      entry.values.add(value(f));
      map.set(g, entry);
    }
    return [...map.values()].filter((e) => e.values.size > 1);
  };

  return {
    pagesEvaluated,
    byKey: {
      selector: summarize('selector'),
      selectorWithoutPosition: summarize('selectorWithoutPosition'),
      html: summarize('html'),
    },
    split: collect(keyOf.html, (f) => f.selector).map(({ first, values }) => ({
      ruleId: first.ruleId,
      html: normalizedHtml(first.htmlSnippet),
      selectors: [...values].sort(),
    })),
    merged: collect(keyOf.selector, (f) => normalizedHtml(f.htmlSnippet)).map(
      ({ first, values }) => ({
        ruleId: first.ruleId,
        selector: first.selector,
        htmls: [...values].sort(),
      }),
    ),
  };
}
