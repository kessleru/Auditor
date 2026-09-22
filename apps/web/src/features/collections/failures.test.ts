import { describe, expect, it } from 'vitest';
import { describeFailure } from './failures';

describe('describeFailure', () => {
  it.each([
    [null, 403, 'Acesso automatizado bloqueado pelo servidor (HTTP 403)'],
    [null, 503, 'O servidor do portal respondeu com erro (HTTP 503)'],
    [null, 404, 'A página não foi encontrada ou não está disponível (HTTP 404)'],
    ['page.goto: Timeout 30000ms exceeded.', null, 'Tempo de resposta esgotado após 30 segundos'],
    ['net::ERR_CERT_DATE_INVALID at https://x', null, 'Certificado de segurança inválido'],
    ['net::ERR_CONNECTION_REFUSED at http://x', null, 'Conexão recusada pelo servidor'],
    ['algo estranho', null, 'algo estranho'],
  ])('%s / %s', (error, status, expected) => {
    expect(describeFailure(error, status)).toBe(expected);
  });
});
