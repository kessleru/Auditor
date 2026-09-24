import { describe, expect, it } from 'vitest';
import { loadEnv } from './env.js';

describe('loadEnv', () => {
  it('aplica os valores padrão', () => {
    const env = loadEnv({});
    expect(env.NODE_ENV).toBe('development');
    expect(env.API_PORT).toBe(3333);
    expect(env.WEB_ORIGIN).toBe('http://localhost:5173');
  });

  it('converte a porta para número', () => {
    expect(loadEnv({ API_PORT: '4000' }).API_PORT).toBe(4000);
  });

  it('rejeita valores inválidos', () => {
    expect(() => loadEnv({ API_PORT: 'abc' })).toThrow(/API_PORT/);
    expect(() => loadEnv({ WEB_ORIGIN: 'não é url' })).toThrow(/WEB_ORIGIN/);
  });

  it.each([
    [undefined, false],
    ['', false],
    ['false', false],
    ['true', true],
    ['1', 1],
    ['uniquelocal', 'uniquelocal'],
  ])('TRUST_PROXY=%s → %s', (value, expected) => {
    expect(loadEnv(value === undefined ? {} : { TRUST_PROXY: value }).TRUST_PROXY).toBe(expected);
  });

  it('COOKIE_SECURE é auto por padrão e recusa outros valores', () => {
    expect(loadEnv({}).COOKIE_SECURE).toBe('auto');
    expect(() => loadEnv({ COOKIE_SECURE: 'sim' })).toThrow(/COOKIE_SECURE/);
  });
});
