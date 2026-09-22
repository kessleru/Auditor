import { describe, expect, it } from 'vitest';
import { ruleTexts } from './rule-texts.js';

describe('ruleTexts', () => {
  it('traduz pelo locale pt_BR do axe-core', () => {
    expect(ruleTexts('image-alt', 'Images must have alternative text').title).toBe(
      'Imagens devem ter texto alternativo',
    );
  });

  it('sem tradução, usa o texto gravado', () => {
    expect(ruleTexts('target-size', 'Ensure touch targets have sufficient size')).toEqual({
      title: 'Ensure touch targets have sufficient size',
      description: 'Ensure touch targets have sufficient size',
    });
  });
});
