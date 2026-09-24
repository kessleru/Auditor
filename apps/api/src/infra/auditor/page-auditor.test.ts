import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HostThrottle } from '../crawler/throttle.js';
import { closedPortUrl, htmlFixture, startLocalSite } from './__fixtures__/local-server.js';
import { countRules, findingsFromViolations } from './axe-mapping.js';
import { AXE_VERSION, createPlaywrightAuditor, describeFailure } from './page-auditor.js';

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
    '/edital.pdf': { status: 200, body: '%PDF-1.4', contentType: 'application/pdf' },
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
    if (!outcome.ok) {
      expect(outcome.error).toBe('Conexão recusada pelo servidor (net::ERR_CONNECTION_REFUSED).');
    }
  });

  it('URL que não é página HTML vira falha, sem auditar', async () => {
    const outcome = await auditor.audit(`${site.origin}/edital.pdf`);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error).toMatch(/não é uma página HTML|baixa um arquivo/);
  });

  it('informa as versões usadas', async () => {
    const versions = await auditor.versions();
    expect(versions.axeVersion).toBe('4.13.0');
    // A versão registrada é a que o @axe-core/playwright injeta, a mesma fixada no package.json.
    expect(versions.axeVersion).toBe(AXE_VERSION);
    expect(versions.browserVersion).toMatch(/^Chromium \d+/);
    expect(versions.userAgent).toBe('AuditoriaRF/1.0 (+teste)');
  });
});

describe('describeFailure', () => {
  it.each([
    [
      'page.goto: net::ERR_NAME_NOT_RESOLVED at https://x',
      'Endereço não encontrado (falha de DNS) (net::ERR_NAME_NOT_RESOLVED).',
    ],
    [
      'page.goto: net::ERR_CERT_DATE_INVALID at https://x',
      'Certificado de segurança (TLS) inválido (net::ERR_CERT_DATE_INVALID).',
    ],
    ['page.goto: Download is starting', 'A URL baixa um arquivo em vez de abrir uma página.'],
    ['Erro qualquer\ncom pilha', 'Erro qualquer'],
  ])('%s', (message, expected) => {
    expect(describeFailure(new Error(message), 30_000)).toBe(expected);
  });
});
