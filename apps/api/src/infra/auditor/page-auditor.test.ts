import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HostThrottle } from '../crawler/throttle.js';
import { closedPortUrl, htmlFixture, startLocalSite } from './__fixtures__/local-server.js';
import { countRules, findingsFromViolations } from './axe-mapping.js';
import { type Browser, chromium } from 'playwright';
import {
  AXE_VERSION,
  createPlaywrightAuditor,
  describeFailure,
  isTransientFailure,
} from './page-auditor.js';

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
    // Proteção contra robôs: o portal manda para um desafio noutro domínio.
    '/bloqueado': { status: 302, body: '', location: 'http://localhost:{port}/desafio' },
    '/desafio': '<!doctype html><html lang="en"><title>Challenge</title><h1>Are you human?</h1>',
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
    expect(byRule['color-contrast']?.evidenceJson).toMatchObject({
      kind: 'contrast',
      fgColor: '#bbbbbb',
      bgColor: '#ffffff',
      expectedContrastRatio: 4.5,
    });

    // Com o que o navegador leu dos elementos: fonte, imagem, destino do link e tipo do campo.
    const withFacts = Object.fromEntries(
      findingsFromViolations(outcome.results.violations, 1, outcome.elementFacts).map((f) => [
        f.ruleId,
        f.evidenceJson,
      ]),
    );
    expect(withFacts['color-contrast']).toMatchObject({
      kind: 'contrast',
      fontFamily: expect.stringMatching(/\S/),
    });
    expect(withFacts['image-alt']).toEqual({
      kind: 'image',
      src: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=',
    });
    expect(withFacts['link-name']).toEqual({ kind: 'link', href: `${site.origin}/` });
    expect(withFacts['label']).toEqual({ kind: 'field', fieldType: 'text' });
    expect(withFacts['html-has-lang']).toBeNull();

    // Foto de cada elemento reprovado visível (JPEG), nunca da página inteira.
    const shot = (ruleId: string, selector: string) =>
      outcome.screenshots.find((s) => s.ruleId === ruleId && s.selector === selector);
    for (const [ruleId, selector] of [
      ['color-contrast', 'p'],
      ['label', '#busca'],
      ['link-name', '#logo'],
    ]) {
      expect([...(shot(ruleId!, selector!)?.image.subarray(0, 2) ?? [])]).toEqual([0xff, 0xd8]);
    }
    expect(shot('html-has-lang', 'html')).toBeUndefined();
    // A foto sai depois do snapshot: o destaque não aparece no HTML salvo.
    expect(outcome.html).not.toContain('data-auditoria-rf-alvo');

    // A imagem com alt passa em image-alt, mas a regra continua violada: conta como violação.
    const counts = countRules(outcome.results);
    expect(counts.violations).toBe(5);
    expect(outcome.results.passes.map((r) => r.id)).toContain('image-alt');
    expect(outcome.results.testEngine.version).toBe('4.13.0');
    expect(outcome.html).toContain('Portal de teste');
    expect(outcome.httpStatus).toBe(200);
    // Tempo de carregamento medido pelo navegador (Navigation Timing).
    expect(outcome.loadTimeMs).toEqual(expect.any(Number));
    expect(outcome.loadTimeMs).toBeGreaterThan(0);
    expect(outcome.loadTimeMs).toBeLessThan(10_000);
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

  it('página que termina fora do domínio da instituição vira falha, sem auditar o desafio', async () => {
    expect(await auditor.audit(`${site.origin}/bloqueado`, { domain: '127.0.0.1' })).toEqual({
      ok: false,
      httpStatus: 200,
      error:
        'A página redirecionou para localhost, fora do domínio da instituição (127.0.0.1): provável proteção contra robôs. A ferramenta não contorna bloqueios; o portal fica sem dado.',
    });
    // No próprio domínio, segue normal.
    expect((await auditor.audit(`${site.origin}/conforme`, { domain: '127.0.0.1' })).ok).toBe(true);
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
    [
      "browserType.launch: Executable doesn't exist at /x/chrome",
      'O navegador do Playwright não abriu. Instale com: npx playwright install chromium.',
    ],
    ['Erro qualquer\ncom pilha', 'Erro qualquer'],
  ])('%s', (message, expected) => {
    expect(describeFailure(new Error(message), 30_000)).toBe(expected);
  });
});

describe('isTransientFailure', () => {
  it.each([
    'page.goto: net::ERR_CONNECTION_RESET',
    'page.content: Execution context was destroyed, most likely because of a navigation',
    'browser.newContext: Target page, context or browser has been closed',
    'page.goto: Page crashed',
  ])('tenta de novo: %s', (message) => {
    expect(isTransientFailure(new Error(message))).toBe(true);
  });

  it('não repete erro da página em si', () => {
    expect(isTransientFailure(new Error('axe: regra inválida'))).toBe(false);
  });
});

describe('navegador que cai', { timeout: 60_000 }, () => {
  it('abre outro navegador e a coleta continua', async () => {
    const opened: Browser[] = [];
    const resilient = createPlaywrightAuditor({
      userAgent: 'AuditoriaRF/1.0 (+teste)',
      throttle: new HostThrottle(),
      minIntervalMs: 0,
      launch: async () => {
        const browser = await chromium.launch();
        opened.push(browser);
        return browser;
      },
    });
    try {
      expect((await resilient.audit(`${site.origin}/conforme`)).ok).toBe(true);
      await opened[0]!.close(); // simula a queda do processo
      expect((await resilient.audit(`${site.origin}/conforme`)).ok).toBe(true);
      expect(opened).toHaveLength(2);
    } finally {
      await resilient.close();
    }
  });

  it('se o navegador não abre, tenta abrir de novo na página seguinte', async () => {
    let attempts = 0;
    const flaky = createPlaywrightAuditor({
      userAgent: 'UA',
      throttle: new HostThrottle(),
      minIntervalMs: 0,
      launch: async () => {
        attempts++;
        if (attempts === 1) throw new Error("browserType.launch: Executable doesn't exist");
        return chromium.launch();
      },
    });
    try {
      const first = await flaky.audit(`${site.origin}/conforme`);
      expect(first).toMatchObject({ ok: false });
      expect((await flaky.audit(`${site.origin}/conforme`)).ok).toBe(true);
    } finally {
      await flaky.close();
    }
  });
});
