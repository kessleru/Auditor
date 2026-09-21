import { describe, expect, it } from 'vitest';
import { healthResponseSchema } from './health.js';

describe('healthResponseSchema', () => {
  it('aceita uma resposta válida', () => {
    const result = healthResponseSchema.safeParse({
      status: 'ok',
      timestamp: '2026-01-01T00:00:00Z',
    });
    expect(result.success).toBe(true);
  });

  it('rejeita status diferente de ok', () => {
    expect(healthResponseSchema.safeParse({ status: 'down', timestamp: '' }).success).toBe(false);
  });
});
