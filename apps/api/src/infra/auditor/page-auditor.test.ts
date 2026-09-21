import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HostThrottle } from '../crawler/throttle.js';
import { closedPortUrl, htmlFixture, startLocalSite } from './__fixtures__/local-server.js';
import { countRules, findingsFromViolations } from './axe-mapping.js';
import { createPlaywrightAuditor } from './page-auditor.js';

// Navegador real contra HTML servido localmente (critério de aceite da Fase 4).

const auditor = createPlaywrightAuditor({
  userAgent: 'AuditoriaRF/1.0 (+teste)',
  throttle: new HostThrottle(),
  minIntervalMs: 0,
  navigationTimeoutMs: 10_000,
});
let site: Awaited<ReturnType<typeof startLocalSite>>;

beforeAll(async () => {
  site = await startLocalSite({
    '/violacoes': htmlFixture('violacoes.html'),
    '/conforme': htmlFixture('conforme.html'),
    '/erro': { status: 500, body: 'erro' },
  });
});

afterAll(async () => {
  await auditor.close();
  await site.close();
});

describe('createPlaywrightAuditor', { timeout: 60_000 }, () => {
  it('encontra as violações conhecidas da página de teste', async () => {
    const outcome = await auditor.audit(`${site.origin}/violacoes`);
    if (!outcome.ok) throw new Error(outcome.error);

    const violated = outcome.results.violations.map((r) => r.id).sort();
    expect(violated).toEqual([
      'color-contrast',
      'html-has-lang',
      'image-alt',
      'label',
      'link-name',
    ]);

    const findings = findingsFromViolations(outcome.results.violations, 1);
    const byRule = Object.fromEntries(findings.map((f) => [f.ruleId, f]));
    expect(byRule['image-alt']).toMatchObject({
      wcagCriteria: '1.1.1',
      principle: 'perceivable',
      severity: 'critical',
    });
    expect(byRule['color-contrast']).toMatchObject({ wcagCriteria: '1.4.3', selector: 'p' });
    expect(byRule['html-has-lang']).toMatchObject({
      wcagCriteria: '3.1.1',
      principle: 'understandable',
    });
    expect(byRule['link-name']).toMatchObject({
      wcagCriteria: '2.4.4, 4.1.2',
      principle: 'operable',
      selector: '#logo',
    });
    expect(byRule['label']?.selector).toBe('#busca');

    // A imagem com alt passa em image-alt, mas a regra continua violada: conta como violação.
    const counts = countRules(outcome.results);
    expect(counts.violations).toBe(5);
    expect(outcome.results.passes.map((r) => r.id)).toContain('image-alt');
    expect(outcome.results.testEngine.version).toBe('4.13.0');
    expect(outcome.html).toContain('Portal de teste');
    expect(outcome.httpStatus).toBe(200);
  });

  it('página conforme não tem violações', async () => {
    const outcome = await auditor.audit(`${site.origin}/conforme`);
    if (!outcome.ok) throw new Error(outcome.error);
    expect(outcome.results.violations).toEqual([]);
    expect(countRules(outcome.results).passes).toBeGreaterThan(0);
  });

  it('erro HTTP vira falha com o status', async () => {
    expect(await auditor.audit(`${site.origin}/erro`)).toEqual({
      ok: false,
      httpStatus: 500,
      error: 'A página respondeu HTTP 500.',
    });
  });

  it('falha de rede vira falha, após a tentativa extra', async () => {
    const outcome = await auditor.audit(await closedPortUrl());
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error).toMatch(/ERR_CONNECTION_REFUSED/);
  });

  it('informa as versões usadas', async () => {
    const versions = await auditor.versions();
    expect(versions.axeVersion).toBe('4.13.0');
    expect(versions.browserVersion).toMatch(/^Chromium \d+/);
    expect(versions.userAgent).toBe('AuditoriaRF/1.0 (+teste)');
  });
});
