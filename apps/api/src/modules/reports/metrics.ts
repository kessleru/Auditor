import {
  classifyConformity,
  type ConformityClass,
  type FindingValidation,
  type Severity,
  TEMPLATE_MIN_PAGES,
  TEMPLATE_THRESHOLD,
} from '@auditoria-rf/contracts';

// Indicadores da seção 3.3 do plano (ADR 0003). Funções puras.

/** passes / (passes + violations), contados por regra; `null` se nenhuma regra se aplicou. */
export function pageConformity({
  passes,
  violations,
}: {
  passes: number;
  violations: number;
}): number | null {
  const applicable = passes + violations;
  return applicable === 0 ? null : passes / applicable;
}

export interface PageInput {
  id: number;
  status: 'queued' | 'running' | 'done' | 'failed';
  passesCount: number;
  violationsCount: number;
  incompleteCount: number;
}

export interface FindingInput {
  collectionPageId: number;
  fingerprint: string;
  ruleId: string;
  wcagCriteria: string;
  severity: Severity;
  validation: FindingValidation;
}

export interface Problem {
  fingerprint: string;
  ruleId: string;
  wcagCriteria: string;
  severity: Severity;
  /** Elementos reprovados, somando todas as páginas. */
  occurrences: number;
  /** Páginas em que o problema aparece. */
  pages: number;
  template: boolean;
}

export type InstitutionSummary =
  | {
      status: 'evaluated';
      pagesTotal: number;
      pagesEvaluated: number;
      pagesFailed: number;
      /** Média das páginas avaliadas com regra aplicável. */
      conformity: number | null;
      classification: ConformityClass | null;
      distinctProblems: number;
      occurrences: number;
      templateProblems: number;
      criticalProblems: number;
      /** Achados ainda não revisados pelo auditor. */
      pendingValidation: number;
      /** Regras que exigem revisão humana (fora do cálculo, mas exibidas). */
      incompleteRules: number;
      problems: Problem[];
    }
  | {
      /** Portal que falhou: ausência de dado, nunca 0% nem incluído em médias (seção 3.2.8). */
      status: 'no_data';
      pagesTotal: number;
      pagesEvaluated: 0;
      pagesFailed: number;
    };

/**
 * Regras cujos elementos reprovados na página foram TODOS marcados como falso positivo deixam de
 * ser violação e passam a contar como passe (decisão com o autor; ADR 0003, adendo).
 */
export function adjustedCounts(page: PageInput, findings: readonly FindingInput[]) {
  const byRule = new Map<string, FindingValidation[]>();
  for (const f of findings) {
    if (f.collectionPageId !== page.id) continue;
    byRule.set(f.ruleId, [...(byRule.get(f.ruleId) ?? []), f.validation]);
  }
  const dismissed = [...byRule.values()].filter((validations) =>
    validations.every((v) => v === 'false_positive'),
  ).length;
  return { passes: page.passesCount + dismissed, violations: page.violationsCount - dismissed };
}

export interface SummaryOptions {
  /**
   * Quais achados contam como problema: `valid` = tudo que não é falso positivo (visão do
   * auditor); `confirmed` = só o que o auditor confirmou (visão pública).
   */
  problems?: 'valid' | 'confirmed';
}

/** Resumo de uma instituição numa coleta. Falsos positivos nunca contam como problema. */
export function summarizeInstitution(
  pages: readonly PageInput[],
  findings: readonly FindingInput[],
  { problems: countedProblems = 'valid' }: SummaryOptions = {},
): InstitutionSummary {
  const evaluated = pages.filter((p) => p.status === 'done');
  const failed = pages.filter((p) => p.status === 'failed').length;
  if (evaluated.length === 0) {
    return { status: 'no_data', pagesTotal: pages.length, pagesEvaluated: 0, pagesFailed: failed };
  }

  const conformities = evaluated
    .map((p) => pageConformity(adjustedCounts(p, findings)))
    .filter((c): c is number => c !== null);
  const conformity =
    conformities.length === 0
      ? null
      : conformities.reduce((a, b) => a + b, 0) / conformities.length;

  const evaluatedIds = new Set(evaluated.map((p) => p.id));
  const groups = new Map<
    string,
    { first: FindingInput; occurrences: number; pages: Set<number> }
  >();
  for (const finding of findings) {
    const counts =
      countedProblems === 'confirmed'
        ? finding.validation === 'confirmed'
        : finding.validation !== 'false_positive';
    if (!counts || !evaluatedIds.has(finding.collectionPageId)) continue;
    const group = groups.get(finding.fingerprint) ?? {
      first: finding,
      occurrences: 0,
      pages: new Set<number>(),
    };
    group.occurrences++;
    group.pages.add(finding.collectionPageId);
    groups.set(finding.fingerprint, group);
  }

  const canBeTemplate = evaluated.length >= TEMPLATE_MIN_PAGES;
  const problems: Problem[] = [...groups.entries()]
    .map(([fingerprint, g]) => ({
      fingerprint,
      ruleId: g.first.ruleId,
      wcagCriteria: g.first.wcagCriteria,
      severity: g.first.severity,
      occurrences: g.occurrences,
      pages: g.pages.size,
      template: canBeTemplate && g.pages.size / evaluated.length >= TEMPLATE_THRESHOLD,
    }))
    // Template primeiro (maior retorno), depois críticos, depois os mais frequentes.
    .sort(
      (a, b) =>
        Number(b.template) - Number(a.template) ||
        Number(b.severity === 'critical') - Number(a.severity === 'critical') ||
        b.pages - a.pages ||
        b.occurrences - a.occurrences ||
        a.ruleId.localeCompare(b.ruleId),
    );

  return {
    status: 'evaluated',
    pagesTotal: pages.length,
    pagesEvaluated: evaluated.length,
    pagesFailed: failed,
    conformity,
    classification: conformity === null ? null : classifyConformity(conformity),
    distinctProblems: problems.length,
    occurrences: problems.reduce((sum, p) => sum + p.occurrences, 0),
    templateProblems: problems.filter((p) => p.template).length,
    criticalProblems: problems.filter((p) => p.severity === 'critical').length,
    pendingValidation: findings.filter(
      (f) => f.validation === 'pending' && evaluatedIds.has(f.collectionPageId),
    ).length,
    incompleteRules: evaluated.reduce((sum, p) => sum + p.incompleteCount, 0),
    problems,
  };
}

/** Média entre instituições: as sem dado ficam fora (seção 3.2.8). */
export function averageConformity(summaries: readonly InstitutionSummary[]): number | null {
  const values = summaries
    .map((s) => (s.status === 'evaluated' ? s.conformity : null))
    .filter((c): c is number => c !== null);
  return values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length;
}
