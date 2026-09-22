import { describe, expect, it } from 'vitest';
import {
  averageConformity,
  type FindingInput,
  type PageInput,
  pageConformity,
  summarizeInstitution,
} from './metrics.js';

const page = (
  id: number,
  passes: number,
  violations: number,
  status: PageInput['status'] = 'done',
): PageInput => ({
  id,
  status,
  passesCount: passes,
  violationsCount: violations,
  incompleteCount: 1,
});

const finding = (
  pageId: number,
  fingerprint: string,
  overrides: Partial<FindingInput> = {},
): FindingInput => ({
  collectionPageId: pageId,
  fingerprint,
  ruleId: `regra-${fingerprint}`,
  wcagCriteria: '1.1.1',
  severity: 'critical',
  validation: 'pending',
  ...overrides,
});

describe('pageConformity', () => {
  it('é passes / (passes + violations)', () => {
    expect(pageConformity({ passes: 30, violations: 10 })).toBe(0.75);
    expect(pageConformity({ passes: 0, violations: 5 })).toBe(0);
  });

  it('é indefinida quando nenhuma regra se aplica', () => {
    expect(pageConformity({ passes: 0, violations: 0 })).toBeNull();
  });
});

describe('summarizeInstitution', () => {
  it('faz a média só das páginas avaliadas com sucesso', () => {
    const summary = summarizeInstitution(
      [page(1, 9, 1), page(2, 5, 5), page(3, 0, 0, 'failed')],
      [],
    );
    expect(summary).toMatchObject({
      status: 'evaluated',
      pagesTotal: 3,
      pagesEvaluated: 2,
      pagesFailed: 1,
    });
    if (summary.status !== 'evaluated') return;
    expect(summary.conformity).toBeCloseTo(0.7);
    expect(summary.classification).toBe('partial');
    expect(summary.incompleteRules).toBe(2);
  });

  it('página sem regra aplicável conta como avaliada, mas fica fora da média', () => {
    const summary = summarizeInstitution([page(1, 8, 2), page(2, 0, 0)], []);
    if (summary.status !== 'evaluated') throw new Error();
    expect(summary.pagesEvaluated).toBe(2);
    expect(summary.conformity).toBeCloseTo(0.8);
  });

  it('portal sem nenhuma página avaliada é ausência de dado, não 0%', () => {
    expect(summarizeInstitution([page(1, 0, 0, 'failed'), page(2, 0, 0, 'failed')], [])).toEqual({
      status: 'no_data',
      pagesTotal: 2,
      pagesEvaluated: 0,
      pagesFailed: 2,
    });
  });

  it('agrupa por fingerprint: problemas distintos e ocorrências', () => {
    const summary = summarizeInstitution(
      [page(1, 5, 1), page(2, 5, 1), page(3, 5, 1), page(4, 5, 1), page(5, 5, 1)],
      [
        // cabeçalho: em todas as 5 páginas, 2 elementos numa delas
        ...[1, 2, 3, 4, 5].map((p) => finding(p, 'cabecalho')),
        finding(1, 'cabecalho'),
        // em 4 de 5 páginas = 80%: template
        ...[1, 2, 3, 4].map((p) => finding(p, 'rodape', { severity: 'moderate' })),
        // em 3 de 5: não é template
        ...[1, 2, 3].map((p) => finding(p, 'menu')),
      ],
    );
    if (summary.status !== 'evaluated') throw new Error();
    expect(summary.distinctProblems).toBe(3);
    expect(summary.occurrences).toBe(13);
    expect(summary.templateProblems).toBe(2);
    expect(
      summary.problems.map((p) => [p.fingerprint, p.pages, p.occurrences, p.template]),
    ).toEqual([
      ['cabecalho', 5, 6, true],
      ['rodape', 4, 4, true],
      ['menu', 3, 3, false],
    ]);
  });

  it('não marca template com menos de 2 páginas avaliadas', () => {
    const summary = summarizeInstitution(
      [page(1, 5, 1), page(2, 0, 0, 'failed')],
      [finding(1, 'x')],
    );
    if (summary.status !== 'evaluated') throw new Error();
    expect(summary.problems[0]?.template).toBe(false);
  });

  it('ignora falsos positivos e achados de páginas que não foram avaliadas', () => {
    const summary = summarizeInstitution(
      [page(1, 5, 1), page(2, 0, 0, 'failed')],
      [
        finding(1, 'a', { validation: 'false_positive' }),
        finding(1, 'b', { validation: 'confirmed' }),
        finding(2, 'c'),
      ],
    );
    if (summary.status !== 'evaluated') throw new Error();
    expect(summary.problems.map((p) => p.fingerprint)).toEqual(['b']);
  });
});

describe('averageConformity', () => {
  it('ignora instituições sem dado', () => {
    const a = summarizeInstitution([page(1, 9, 1)], []);
    const b = summarizeInstitution([page(2, 1, 1)], []);
    const semDado = summarizeInstitution([page(3, 0, 0, 'failed')], []);
    expect(averageConformity([a, b, semDado])).toBeCloseTo(0.7);
    expect(averageConformity([semDado])).toBeNull();
  });
});

describe('validação dos achados (ADR 0003, adendo)', () => {
  it('regra com todos os elementos falsos positivos vira passe na conformidade', () => {
    // Página: 8 passes, 2 regras violadas (a, b). Todos os elementos de "a" são falso positivo.
    const findings = [
      finding(1, 'a1', { ruleId: 'a', validation: 'false_positive' }),
      finding(1, 'a2', { ruleId: 'a', validation: 'false_positive' }),
      finding(1, 'b1', { ruleId: 'b', validation: 'confirmed' }),
    ];
    const summary = summarizeInstitution([page(1, 8, 2)], findings);
    if (summary.status !== 'evaluated') throw new Error();
    expect(summary.conformity).toBeCloseTo(9 / 10);
  });

  it('regra com algum elemento não descartado continua violação', () => {
    const findings = [
      finding(1, 'a1', { ruleId: 'a', validation: 'false_positive' }),
      finding(1, 'a2', { ruleId: 'a', validation: 'pending' }),
    ];
    const summary = summarizeInstitution([page(1, 8, 2)], findings);
    if (summary.status !== 'evaluated') throw new Error();
    expect(summary.conformity).toBeCloseTo(8 / 10);
  });

  it('na visão pública, só achados confirmados contam como problema', () => {
    const findings = [
      finding(1, 'a', { validation: 'confirmed', severity: 'critical' }),
      finding(1, 'b', { validation: 'pending' }),
      finding(1, 'c', { validation: 'false_positive' }),
    ];
    const pub = summarizeInstitution([page(1, 5, 3)], findings, { problems: 'confirmed' });
    const all = summarizeInstitution([page(1, 5, 3)], findings);
    if (pub.status !== 'evaluated' || all.status !== 'evaluated') throw new Error();
    expect(pub.problems.map((p) => p.fingerprint)).toEqual(['a']);
    expect(pub.criticalProblems).toBe(1);
    expect(pub.pendingValidation).toBe(1);
    expect(all.problems.map((p) => p.fingerprint).sort()).toEqual(['a', 'b']);
  });
});
