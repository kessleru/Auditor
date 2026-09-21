import { expect } from 'vitest';
import { axe } from 'vitest-axe';

/**
 * Falha o teste se o axe encontrar violações. No jsdom, regras que dependem de layout (como
 * contraste de cor) não são avaliadas; o contraste é verificado no navegador real.
 */
export async function expectNoAxeViolations(container: Element) {
  const results = await axe(container);
  const summary = results.violations.map(
    (v) => `${v.id}: ${v.help} → ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
  );
  expect(summary).toEqual([]);
}
