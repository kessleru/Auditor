import type { Result } from 'axe-core';
import { describe, expect, it } from 'vitest';
import {
  countRules,
  criteriaFromTags,
  findingsFromViolations,
  fingerprintOf,
  principleOf,
  selectorOf,
  severityOf,
} from './axe-mapping.js';

const rule = (id: string, overrides: Partial<Result> = {}): Result =>
  ({
    id,
    impact: 'serious',
    tags: [],
    description: '',
    help: `ajuda ${id}`,
    helpUrl: `https://dequeuniversity.com/${id}`,
    nodes: [],
    ...overrides,
  }) as Result;

describe('criteriaFromTags', () => {
  it('converte e ordena as tags de critério, ignorando as de nível', () => {
    expect(criteriaFromTags(['cat.aria', 'wcag2a', 'wcag412', 'wcag244', 'wcag21aa'])).toEqual([
      '2.4.4',
      '4.1.2',
    ]);
    expect(criteriaFromTags(['wcag1412', 'wcag143'])).toEqual(['1.4.3', '1.4.12']);
    expect(criteriaFromTags(['best-practice'])).toEqual([]);
  });
});

describe('principleOf', () => {
  it('usa o primeiro dígito do menor critério', () => {
    expect(principleOf(['1.1.1'])).toBe('perceivable');
    expect(principleOf(['2.4.4', '4.1.2'])).toBe('operable');
    expect(principleOf(['3.1.1'])).toBe('understandable');
    expect(principleOf(['4.1.2'])).toBe('robust');
    expect(principleOf([])).toBeNull();
  });
});

describe('severityOf', () => {
  it.each([
    ['critical', 'critical'],
    ['serious', 'critical'],
    ['moderate', 'moderate'],
    ['minor', 'moderate'],
  ] as const)('%s → %s', (impact, severity) => {
    expect(severityOf(impact)).toBe(severity);
  });
});

describe('selectorOf e fingerprintOf', () => {
  it('normaliza só espaços e junta iframes/shadow DOM', () => {
    expect(selectorOf(['#menu  >   li:nth-child(3) > a'])).toBe('#menu > li:nth-child(3) > a');
    expect(selectorOf([['#host', '.btn']] as never)).toBe('#host >>> .btn');
    expect(selectorOf(['iframe', 'img'])).toBe('iframe | img');
  });

  it('o fingerprint depende de regra, seletor e instituição', () => {
    const base = fingerprintOf('image-alt', 'img.logo', 1);
    expect(base).toMatch(/^[0-9a-f]{64}$/);
    expect(fingerprintOf('image-alt', 'img.logo', 1)).toBe(base);
    expect(fingerprintOf('image-alt', 'img.logo', 2)).not.toBe(base);
    expect(fingerprintOf('link-name', 'img.logo', 1)).not.toBe(base);
    expect(fingerprintOf('image-alt', 'img.foto', 1)).not.toBe(base);
  });
});

describe('countRules', () => {
  it('conta regras, e regra violada não conta como passe', () => {
    const counts = countRules({
      passes: [rule('image-alt'), rule('html-has-lang'), rule('label')],
      violations: [rule('image-alt'), rule('color-contrast')],
      incomplete: [rule('color-contrast'), rule('video-caption')],
      inapplicable: [rule('audio-caption')],
    });
    expect(counts).toEqual({ passes: 2, violations: 2, incomplete: 2, inapplicable: 1 });
  });
});

describe('findingsFromViolations', () => {
  it('gera um achado por elemento, com critérios, princípio e severidade', () => {
    const findings = findingsFromViolations(
      [
        rule('link-name', {
          impact: 'serious',
          tags: ['wcag2a', 'wcag412', 'wcag244'],
          nodes: [
            { html: '<a href="/a"></a>', target: ['#topo > a'], impact: 'serious' },
            { html: '<a href="/b"></a>', target: ['footer a'], impact: 'minor' },
          ] as Result['nodes'],
        }),
      ],
      7,
    );

    expect(findings).toHaveLength(2);
    expect(findings[0]).toMatchObject({
      ruleId: 'link-name',
      wcagCriteria: '2.4.4, 4.1.2',
      principle: 'operable',
      axeImpact: 'serious',
      severity: 'critical',
      selector: '#topo > a',
      htmlSnippet: '<a href="/a"></a>',
      help: 'ajuda link-name',
      fingerprint: fingerprintOf('link-name', '#topo > a', 7),
    });
    expect(findings[1]).toMatchObject({ axeImpact: 'minor', severity: 'moderate' });
  });

  it('corta trechos de HTML longos', () => {
    const [finding] = findingsFromViolations(
      [
        rule('image-alt', {
          tags: ['wcag111'],
          nodes: [{ html: 'x'.repeat(5000), target: ['img'] }] as Result['nodes'],
        }),
      ],
      1,
    );
    expect(finding?.htmlSnippet).toHaveLength(2001);
  });
});
