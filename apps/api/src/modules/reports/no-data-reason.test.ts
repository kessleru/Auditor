import { describe, expect, it } from 'vitest';
import { mainNoDataReason } from './public-reports.service.js';

const failed = (error: string | null, httpStatus: number | null = null) => ({
  status: 'failed',
  error,
  httpStatus,
});

describe('mainNoDataReason', () => {
  it('o motivo mais comum entre as páginas que falharam', () => {
    expect(
      mainNoDataReason([
        failed('Tempo esgotado: a página não terminou de carregar em 30 s.'),
        failed('A página respondeu HTTP 403.', 403),
        failed('A página respondeu HTTP 403.', 403),
      ]),
    ).toBe('blocked');
    expect(
      mainNoDataReason([
        failed('Tempo esgotado: a página não terminou de carregar em 30 s.'),
        failed('Conexão recusada pelo servidor (net::ERR_CONNECTION_REFUSED).'),
        failed('A página respondeu HTTP 403.', 403),
      ]),
    ).toBe('unavailable');
  });

  it('empate fica com o bloqueio, que explica mais', () => {
    expect(mainNoDataReason([failed('A página respondeu HTTP 403.', 403), failed(null, 503)])).toBe(
      'blocked',
    );
  });

  it('sem página que falhou, outro motivo (nunca bloqueio por engano)', () => {
    expect(mainNoDataReason([])).toBe('other');
    expect(mainNoDataReason([{ status: 'queued', error: null, httpStatus: null }])).toBe('other');
  });
});
