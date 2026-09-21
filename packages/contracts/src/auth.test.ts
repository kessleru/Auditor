import { describe, expect, it } from 'vitest';
import { loginRequestSchema } from './auth.js';

describe('loginRequestSchema', () => {
  it('normaliza o e-mail', () => {
    const parsed = loginRequestSchema.parse({ email: '  Auditor@IFTM.edu.br ', password: 'x' });
    expect(parsed.email).toBe('auditor@iftm.edu.br');
  });

  it('exige senha', () => {
    expect(loginRequestSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false);
  });
});
