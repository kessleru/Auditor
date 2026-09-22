import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Critério de aceite da Fase 10: toda animação respeita prefers-reduced-motion e as de interface
// duram no máximo 300 ms. Verificado no código-fonte, porque o jsdom não executa CSS.

const SRC = join(__dirname, '..');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('movimento', () => {
  it('toda classe animate-* e transition-transform está sob motion-safe:', () => {
    const offenders = sources(SRC).flatMap((file) => {
      const text = readFileSync(file, 'utf8');
      return [...text.matchAll(/(\S*)(animate-[a-z-]+|transition-transform)/g)]
        .filter(([, prefix]) => !prefix?.endsWith('motion-safe:'))
        .map(([match]) => `${file.replace(SRC, 'src')}: ${match}`);
    });
    expect(offenders).toEqual([]);
  });

  it('animações de interface duram no máximo 300 ms; as da marca não entram em loop', () => {
    const css = readFileSync(join(SRC, 'styles/tokens.css'), 'utf8');
    const tokens = [...css.matchAll(/--animate-([a-z-]+):\s*[a-z-]+\s+(\d+)ms([^;]*);/g)];
    expect(tokens.length).toBeGreaterThan(0);
    for (const [, name, duration, rest] of tokens) {
      expect(rest, `${name} não pode ser infinito`).not.toMatch(/infinite/);
      if (!name!.startsWith('brand-'))
        expect(Number(duration), `--animate-${name}`).toBeLessThanOrEqual(300);
    }
  });
});
