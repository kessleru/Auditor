import { errors } from 'playwright';
import { describe, expect, it } from 'vitest';
import { classifyFailure } from '@auditoria-rf/contracts';
import { describeFailure, offDomainReason } from './page-auditor.js';

// O classificador fica em contracts; este teste amarra cada mensagem que o motor grava ao grupo.

const described = (message: string) => describeFailure(new Error(message), 30_000);

describe('classifyFailure', () => {
  it.each([
    // Mensagens que o motor grava hoje.
    [
      describeFailure(new errors.TimeoutError('page.goto: Timeout 30000ms exceeded'), 30_000),
      null,
      'timeout',
    ],
    ['A página respondeu HTTP 404.', 404, 'http'],
    ['A página respondeu HTTP 503.', 503, 'http'],
    [offDomainReason('https://validate.perfdrive.com/x', 'iftm.edu.br'), null, 'off_domain'],
    [described('page.goto: net::ERR_NAME_NOT_RESOLVED at https://x'), null, 'network'],
    [described('page.goto: net::ERR_CONNECTION_REFUSED at https://x'), null, 'network'],
    [described('page.goto: net::ERR_CONNECTION_RESET at https://x'), null, 'network'],
    [described('page.goto: net::ERR_CONNECTION_TIMED_OUT at https://x'), null, 'network'],
    [described('page.goto: net::ERR_CERT_DATE_INVALID at https://x'), null, 'network'],
    [described('page.goto: net::ERR_TOO_MANY_REDIRECTS at https://x'), null, 'network'],
    [described('page.goto: net::ERR_INTERNET_DISCONNECTED at https://x'), null, 'tool'],
    [described('page.goto: Download is starting'), null, 'not_html'],
    ['A URL não é uma página HTML (application/pdf).', 200, 'not_html'],
    [described("browserType.launch: Executable doesn't exist at /x"), null, 'tool'],
    [
      `Não foi possível iniciar o navegador: ${described("browserType.launch: Executable doesn't exist")}`,
      null,
      'tool',
    ],
    ['O axe-core executado (4.10.0) difere do registrado na coleta (4.13.0).', 200, 'tool'],
    ['Erro interno: ENOSPC: no space left on device', null, 'tool'],
    // O navegador caiu ou perdeu a página: falha da ferramenta, não do portal.
    [described('page.goto: Target page, context or browser has been closed'), null, 'tool'],
    [described('browser.newContext: Browser has been closed'), null, 'tool'],
    [described('page.goto: Page crashed'), null, 'tool'],
    [
      described(
        'page.content: Execution context was destroyed, most likely because of a navigation',
      ),
      null,
      'tool',
    ],
    // Coletas antigas gravavam a mensagem do Playwright como veio.
    ['page.goto: Timeout 30000ms exceeded.', null, 'timeout'],
    ['page.goto: net::ERR_SSL_PROTOCOL_ERROR at https://x', null, 'network'],
    ['Algo que ninguém previu', null, 'other'],
  ] as const)('%s → %s', (error, httpStatus, kind) => {
    expect(classifyFailure(error, httpStatus)).toBe(kind);
  });

  it('status HTTP de erro vale mesmo sem mensagem', () => {
    expect(classifyFailure(null, 403)).toBe('http');
  });
});
