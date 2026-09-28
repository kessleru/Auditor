// Teste-reteste da auditoria automatizada: a mesma página auditada mais de uma vez, sem nada
// mudar no método, dá o mesmo resultado? Carrossel, anúncio e conteúdo que muda a cada acesso
// mexem nas violações; este número entra nas limitações do estudo. Nada é gravado no banco.

export type RetestRun =
  | {
      ok: true;
      /** Regras violadas na rodada. */
      violatedRules: string[];
      /** Elementos reprovados (regra + seletor). */
      findings: string[];
      conformity: number | null;
    }
  | { ok: false; error: string };

export interface RetestComparison {
  /** Mesmas regras violadas e mesmos elementos em todas as rodadas; `null` se alguma falhou. */
  stable: boolean | null;
  /** Concordância das regras violadas entre as rodadas (interseção ÷ união), de 0 a 1. */
  ruleAgreement: number | null;
  /** Concordância dos elementos reprovados entre as rodadas, de 0 a 1. */
  findingAgreement: number | null;
  /** Regras violadas só em parte das rodadas. */
  unstableRules: string[];
}

/** Interseção ÷ união dos conjuntos; todos vazios contam como concordância total. */
export function agreement(sets: readonly Set<string>[]): number {
  const union = new Set(sets.flatMap((s) => [...s]));
  if (union.size === 0) return 1;
  const common = [...union].filter((item) => sets.every((s) => s.has(item)));
  return common.length / union.size;
}

export function compareRuns(runs: readonly RetestRun[]): RetestComparison {
  const ok = runs.filter((r): r is Extract<RetestRun, { ok: true }> => r.ok);
  if (ok.length !== runs.length || ok.length < 2) {
    return { stable: null, ruleAgreement: null, findingAgreement: null, unstableRules: [] };
  }
  const rules = ok.map((r) => new Set(r.violatedRules));
  const findings = ok.map((r) => new Set(r.findings));
  const ruleAgreement = agreement(rules);
  const findingAgreement = agreement(findings);
  const allRules = new Set(rules.flatMap((s) => [...s]));
  return {
    stable: ruleAgreement === 1 && findingAgreement === 1,
    ruleAgreement,
    findingAgreement,
    unstableRules: [...allRules].filter((rule) => !rules.every((s) => s.has(rule))).sort(),
  };
}

export interface RetestSummary {
  pages: number;
  /** Páginas avaliadas em todas as rodadas (as demais ficam fora das médias). */
  compared: number;
  stable: number;
  meanRuleAgreement: number | null;
  meanFindingAgreement: number | null;
}

export function summarizeRetest(comparisons: readonly RetestComparison[]): RetestSummary {
  const compared = comparisons.filter((c) => c.stable !== null);
  const mean = (values: number[]) =>
    values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length;
  return {
    pages: comparisons.length,
    compared: compared.length,
    stable: compared.filter((c) => c.stable).length,
    meanRuleAgreement: mean(compared.map((c) => c.ruleAgreement as number)),
    meanFindingAgreement: mean(compared.map((c) => c.findingAgreement as number)),
  };
}
