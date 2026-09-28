import { describe, expect, it } from 'vitest';
import { classifyConformity, isTemplateProblem } from './conformity.js';

describe('classifyConformity', () => {
  it.each([
    [1, 'good'],
    [0.75, 'good'],
    [0.7499, 'partial'],
    [0.5, 'partial'],
    [0.4999, 'critical'],
    [0, 'critical'],
  ] as const)('%d → %s', (value, expected) => {
    expect(classifyConformity(value)).toBe(expected);
  });
});

describe('isTemplateProblem', () => {
  it('80% ou mais das páginas avaliadas, com ao menos 2 páginas', () => {
    expect(isTemplateProblem(4, 5)).toBe(true);
    expect(isTemplateProblem(3, 5)).toBe(false);
    expect(isTemplateProblem(2, 2)).toBe(true);
    expect(isTemplateProblem(1, 1)).toBe(false);
    expect(isTemplateProblem(0, 0)).toBe(false);
  });
});
