import {
  classifyConformity,
  type ConformityClass,
  type FindingValidation,
  isTemplateProblem,
  type PageFunctionKey,
  pageFunctionKeys,
  type Severity,
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
  /** Função da página no momento da coleta (`collection_pages.function_id`). */
  functionKey?: PageFunctionKey | null;
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
  /**
   * Só as páginas destas funções (núcleo comum, ADR 0013). Sem isto, todas as páginas contam.
   */
  functions?: readonly PageFunctionKey[];
}

/** Resumo de uma instituição numa coleta. Falsos positivos nunca contam como problema. */
export function summarizeInstitution(
  pages: readonly PageInput[],
  findings: readonly FindingInput[],
  { problems: countedProblems = 'valid', functions }: SummaryOptions = {},
): InstitutionSummary {
  if (functions) {
    const wanted = new Set<PageFunctionKey | null | undefined>(functions);
    pages = pages.filter((p) => wanted.has(p.functionKey));
  }
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

  const problems: Problem[] = [...groups.entries()]
    .map(([fingerprint, g]) => ({
      fingerprint,
      ruleId: g.first.ruleId,
      wcagCriteria: g.first.wcagCriteria,
      severity: g.first.severity,
      occurrences: g.occurrences,
      pages: g.pages.size,
      template: isTemplateProblem(g.pages.size, evaluated.length),
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

// Comparação justa entre conjuntos diferentes de páginas (ADR 0013) ---------------------------

/** Funções com página avaliada com sucesso. */
export function evaluatedFunctions(pages: readonly PageInput[]): Set<PageFunctionKey> {
  return new Set(
    pages
      .filter((p) => p.status === 'done' && p.functionKey)
      .map((p) => p.functionKey as PageFunctionKey),
  );
}

/**
 * Núcleo comum: funções avaliadas com sucesso em **todas** as instituições comparadas (as sem dado
 * ficam de fora, seção 3.2.8), na ordem de `pageFunctionKeys`. O ranking compara só essas
 * páginas: cada instituição é medida sobre o mesmo conjunto de funções, e uma com mais páginas
 * não acumula mais problemas só por isso.
 */
export function commonCore(perInstitution: readonly Set<PageFunctionKey>[]): PageFunctionKey[] {
  if (perInstitution.length === 0) return [];
  return pageFunctionKeys.filter((key) => perInstitution.every((set) => set.has(key)));
}

export interface Coverage {
  /** Funções do escopo da coleta com página no portal. */
  found: number;
  /** Funções do escopo da coleta. */
  expected: number;
  /** Funções procuradas e não encontradas no portal. */
  missing: PageFunctionKey[];
}

/**
 * Cobertura: quantas funções do escopo o portal tem. A coleta só começa com cada função
 * confirmada ou marcada como não encontrada, então função do escopo sem página = não encontrada.
 * `null` para coletas antigas, sem escopo explícito (a cobertura não foi medida).
 */
export function coverageOf(
  pages: readonly PageInput[],
  expected: readonly PageFunctionKey[] | null,
): Coverage | null {
  if (!expected) return null;
  const withPage = new Set(pages.map((p) => p.functionKey));
  const missing = expected.filter((key) => !withPage.has(key));
  return { found: expected.length - missing.length, expected: expected.length, missing };
}
