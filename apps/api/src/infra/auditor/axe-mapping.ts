import { createHash } from 'node:crypto';
import type { AxeImpact, FindingEvidence, Severity, WcagPrinciple } from '@auditoria-rf/contracts';
import type { AxeResults, ImpactValue, NodeResult, Result } from 'axe-core';

// Tradução dos resultados do axe-core para o modelo da pesquisa (seções 3.2 e 3.3; ADR 0003).

const PRINCIPLES: Record<string, WcagPrinciple> = {
  '1': 'perceivable',
  '2': 'operable',
  '3': 'understandable',
  '4': 'robust',
};

/** Tags `wcagXYZ` → critérios "X.Y.Z" em ordem crescente (ex.: wcag1412 → 1.4.12). */
export function criteriaFromTags(tags: readonly string[]): string[] {
  const criteria = tags
    .map((tag) => /^wcag(\d)(\d)(\d{1,2})$/.exec(tag))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => [Number(m[1]), Number(m[2]), Number(m[3])] as const);
  criteria.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
  return [...new Set(criteria.map((c) => c.join('.')))];
}

/** O princípio é o do menor critério (decisão com o autor; ADR 0003). */
export function principleOf(criteria: readonly string[]): WcagPrinciple | null {
  const first = criteria[0];
  return first ? (PRINCIPLES[first.split('.')[0] as string] ?? null) : null;
}

/** critical/serious → Crítico; moderate/minor → Moderado (seção 3.2.7). */
export function severityOf(impact: AxeImpact): Severity {
  return impact === 'critical' || impact === 'serious' ? 'critical' : 'moderate';
}

/** Seletor do axe (pode atravessar iframes/shadow DOM) → texto, só com espaços normalizados. */
export function selectorOf(target: NodeResult['target']): string {
  const parts = (target as unknown[]).map((part) =>
    Array.isArray(part) ? part.map(String).join(' >>> ') : String(part),
  );
  return parts.join(' | ').replace(/\s+/g, ' ').trim();
}

/** Mesmo problema = mesma regra + mesmo seletor + mesma instituição (seção 2; ADR 0003). */
export function fingerprintOf(ruleId: string, selector: string, institutionId: number): string {
  return createHash('sha256').update(`${ruleId}\n${selector}\n${institutionId}`).digest('hex');
}

export interface RuleCounts {
  passes: number;
  violations: number;
  incomplete: number;
  inapplicable: number;
}

/**
 * Contagem por regra, exclusiva (decisão com o autor; ADR 0003): uma regra com algum elemento
 * reprovado é violação e não conta como passe, mesmo que outros elementos passem.
 */
export function countRules(
  results: Pick<AxeResults, 'passes' | 'violations' | 'incomplete' | 'inapplicable'>,
): RuleCounts {
  const violated = new Set(results.violations.map((r) => r.id));
  return {
    passes: new Set(results.passes.map((r) => r.id).filter((id) => !violated.has(id))).size,
    violations: violated.size,
    incomplete: new Set(results.incomplete.map((r) => r.id)).size,
    inapplicable: new Set(results.inapplicable.map((r) => r.id)).size,
  };
}

export interface FindingDraft {
  ruleId: string;
  wcagCriteria: string;
  principle: WcagPrinciple;
  axeImpact: AxeImpact;
  severity: Severity;
  selector: string;
  htmlSnippet: string;
  help: string;
  helpUrl: string;
  fingerprint: string;
  evidenceJson: FindingEvidence | null;
}

const numberFrom = (value: unknown): number | null => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * O que o navegador leu do elemento reprovado na coleta, depois do axe e do snapshot (o axe não
 * informa): a fonte calculada, o endereço da imagem, o destino do link e o tipo do campo.
 */
export interface ElementFacts {
  fontFamily: string | null;
  src: string | null;
  href: string | null;
  fieldType: string | null;
}

/** Regras cuja evidência vem do elemento (ElementFacts), e não do `data` do axe. */
const IMAGE_RULES = new Set(['image-alt', 'input-image-alt']);
const LINK_RULES = new Set(['link-name']);
const FIELD_RULES = new Set(['label', 'select-name']);
/** Regras para as quais vale ler o elemento na coleta. */
export const FACT_RULES = new Set([
  'color-contrast',
  ...IMAGE_RULES,
  ...LINK_RULES,
  ...FIELD_RULES,
]);

const checkData = (node: NodeResult, checkId: string) =>
  ([...node.any, ...node.all, ...node.none].find((c) => c.id === checkId)?.data ?? {}) as Record<
    string,
    unknown
  >;

/**
 * Evidência do elemento reprovado, para a interface mostrar o problema sem abrir o portal (ADR
 * 0014): o que o axe já mediu (contraste, tamanho do alvo) e, com `facts`, o que o navegador leu
 * do elemento. Sem dado suficiente, `null`: o achado fica com a foto e o código.
 */
export function evidenceOf(
  ruleId: string,
  node: NodeResult,
  facts?: ElementFacts,
): FindingEvidence | null {
  if (ruleId === 'target-size') return targetSizeEvidenceOf(node);
  if (IMAGE_RULES.has(ruleId)) return facts?.src ? { kind: 'image', src: facts.src } : null;
  if (LINK_RULES.has(ruleId)) return facts?.href ? { kind: 'link', href: facts.href } : null;
  if (FIELD_RULES.has(ruleId)) {
    return facts?.fieldType ? { kind: 'field', fieldType: facts.fieldType } : null;
  }
  if (ruleId !== 'color-contrast') return null;
  const data = checkData(node, 'color-contrast');
  const contrastRatio = numberFrom(data['contrastRatio']);
  // "4.5:1" → 4.5; "12.0pt (16px)" → 16.
  const expectedContrastRatio = numberFrom(
    String(data['expectedContrastRatio'] ?? '').split(':')[0],
  );
  const fontSizePx = numberFrom(/\(([\d.]+)px\)/.exec(String(data['fontSize'] ?? ''))?.[1]);
  const { fgColor, bgColor } = data;
  if (
    typeof fgColor !== 'string' ||
    typeof bgColor !== 'string' ||
    contrastRatio === null ||
    expectedContrastRatio === null ||
    fontSizePx === null
  ) {
    return null;
  }
  return {
    kind: 'contrast',
    fgColor,
    bgColor,
    contrastRatio: Math.round(contrastRatio * 100) / 100,
    expectedContrastRatio,
    fontSizePx,
    bold: data['fontWeight'] === 'bold' || (numberFrom(data['fontWeight']) ?? 0) >= 700,
    fontFamily: facts?.fontFamily ?? null,
  };
}

/** Tamanho e distância medidos pelo axe (checks `target-size` e `target-offset`). */
function targetSizeEvidenceOf(node: NodeResult): FindingEvidence | null {
  const size = checkData(node, 'target-size');
  const offset = checkData(node, 'target-offset');
  const widthPx = numberFrom(size['width']);
  const heightPx = numberFrom(size['height']);
  const closestOffsetPx = numberFrom(offset['closestOffset']);
  if ((widthPx === null || heightPx === null) && closestOffsetPx === null) return null;
  return {
    kind: 'target-size',
    widthPx,
    heightPx,
    minSizePx: numberFrom(size['minSize']) ?? 24,
    closestOffsetPx,
    minOffsetPx: numberFrom(offset['minOffset']),
  };
}

const MAX_SNIPPET = 2000;

const isImpact = (value: ImpactValue | undefined): value is AxeImpact =>
  value === 'critical' || value === 'serious' || value === 'moderate' || value === 'minor';

/** Um achado por elemento reprovado; `facts` (por seletor) completa a evidência. */
export function findingsFromViolations(
  violations: readonly Result[],
  institutionId: number,
  facts: Readonly<Record<string, ElementFacts>> = {},
): FindingDraft[] {
  return violations.flatMap((rule) => {
    const criteria = criteriaFromTags(rule.tags);
    const principle = principleOf(criteria);
    // Toda regra das tags WCAG usadas tem critério (verificado no axe-core fixado); sem ele, não há como classificar.
    if (!principle) return [];

    return rule.nodes.map((node) => {
      const impact = isImpact(node.impact)
        ? node.impact
        : isImpact(rule.impact)
          ? rule.impact
          : 'minor';
      const selector = selectorOf(node.target);
      return {
        ruleId: rule.id,
        wcagCriteria: criteria.join(', '),
        principle,
        axeImpact: impact,
        severity: severityOf(impact),
        selector,
        htmlSnippet:
          node.html.length > MAX_SNIPPET ? `${node.html.slice(0, MAX_SNIPPET)}…` : node.html,
        help: rule.help,
        helpUrl: rule.helpUrl,
        fingerprint: fingerprintOf(rule.id, selector, institutionId),
        evidenceJson: evidenceOf(rule.id, node, facts[selector]),
      };
    });
  });
}
