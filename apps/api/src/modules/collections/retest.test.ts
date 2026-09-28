import { describe, expect, it } from 'vitest';
import { agreement, compareRuns, summarizeRetest } from './retest.js';

const run = (violatedRules: string[], findings: string[]) =>
  ({ ok: true, violatedRules, findings, conformity: null }) as const;

describe('teste-reteste', () => {
  it('concordância é interseção sobre união; vazios concordam', () => {
    expect(agreement([new Set(['a', 'b']), new Set(['b', 'c'])])).toBeCloseTo(1 / 3);
    expect(agreement([new Set(), new Set()])).toBe(1);
  });

  it('rodadas iguais são estáveis', () => {
    const same = run(['image-alt'], ['image-alt\nimg.logo']);
    expect(compareRuns([same, same])).toEqual({
      stable: true,
      ruleAgreement: 1,
      findingAgreement: 1,
      unstableRules: [],
    });
  });

  it('carrossel que muda entre rodadas aparece como regra instável', () => {
    const result = compareRuns([
      run(['image-alt', 'color-contrast'], ['image-alt\n.slide-1 img', 'color-contrast\np']),
      run(['color-contrast'], ['color-contrast\np']),
    ]);
    expect(result).toEqual({
      stable: false,
      ruleAgreement: 0.5,
      findingAgreement: 0.5,
      unstableRules: ['image-alt'],
    });
  });

  it('rodada com falha fica fora da comparação e das médias', () => {
    const failed = compareRuns([run([], []), { ok: false, error: 'Tempo esgotado' }]);
    expect(failed.stable).toBeNull();
    expect(
      summarizeRetest([failed, compareRuns([run(['a'], ['a\nx']), run(['a'], ['a\ny'])])]),
    ).toEqual({
      pages: 2,
      compared: 1,
      stable: 0,
      meanRuleAgreement: 1,
      meanFindingAgreement: 0,
    });
  });
});
