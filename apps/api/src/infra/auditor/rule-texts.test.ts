import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { AXE_TAGS } from './page-auditor.js';
import { ruleTexts } from './rule-texts.js';

// O mesmo axe-core que o @axe-core/playwright injeta na página.
const requireHere = createRequire(import.meta.url);
const axe = createRequire(requireHere.resolve('@axe-core/playwright'))('axe-core') as {
  getRules(tags: string[]): { ruleId: string; help: string }[];
};

describe('ruleTexts', () => {
  it('traduz pelo locale pt_BR do axe-core', () => {
    expect(ruleTexts('image-alt', 'Images must have alternative text').title).toBe(
      'Imagens devem ter texto alternativo',
    );
  });

  it('toda regra das tags usadas na coleta tem título em português', () => {
    const rules = axe.getRules(AXE_TAGS);
    expect(rules.length).toBeGreaterThan(50);
    const untranslated = rules.filter((r) => ruleTexts(r.ruleId, r.help).title === r.help);
    expect(untranslated.map((r) => r.ruleId)).toEqual([]);
    expect(ruleTexts('target-size', 'x').title).toBe(
      'Alvos de toque devem ter ao menos 24 px ou espaço suficiente ao redor',
    );
  });

  it('sem tradução, usa o texto gravado', () => {
    expect(ruleTexts('regra-futura', 'Some future rule')).toEqual({
      title: 'Some future rule',
      description: 'Some future rule',
    });
  });
});
