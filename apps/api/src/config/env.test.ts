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
});
