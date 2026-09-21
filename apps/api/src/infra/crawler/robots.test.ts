import { describe, expect, it } from 'vitest';
import { parseRobots } from './robots.js';
import { fixture } from './__fixtures__/site.js';

const robotsUrl = 'https://www.if.edu.br/robots.txt';

describe('parseRobots', () => {
  const rules = parseRobots(robotsUrl, fixture('robots.txt'), 'AuditoriaRF');

  it('usa o grupo específico do nosso robô quando existe', () => {
    expect(rules.isAllowed('https://www.if.edu.br/somente-humanos/a')).toBe(false);
    // O grupo "*" não se aplica a quem tem grupo próprio.
    expect(rules.isAllowed('https://www.if.edu.br/restrito/a')).toBe(true);
    expect(rules.isAllowed('https://www.if.edu.br/ensino')).toBe(true);
  });

  it('aplica o grupo "*" a outros robôs', () => {
    const other = parseRobots(robotsUrl, fixture('robots.txt'), 'OutroRobo');
    expect(other.isAllowed('https://www.if.edu.br/restrito/a')).toBe(false);
    expect(other.isAllowed('https://www.if.edu.br/busca?q=x')).toBe(false);
    expect(other.crawlDelayMs).toBe(2000);
  });

  it('extrai as diretivas Sitemap', () => {
    expect(rules.sitemaps).toEqual(['https://www.if.edu.br/sitemap_index.xml']);
  });

  it('sem robots.txt, libera tudo', () => {
    const empty = parseRobots(robotsUrl, null, 'AuditoriaRF');
    expect(empty.isAllowed('https://www.if.edu.br/qualquer')).toBe(true);
    expect(empty.sitemaps).toEqual([]);
  });

  it('não libera URL de outra origem', () => {
    expect(rules.isAllowed('https://outro.gov.br/a')).toBe(false);
  });
});
