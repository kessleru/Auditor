import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { sessions, users } from '../../db/schema.js';
import { createTestDatabase } from '../../test/db.js';
import { createAuthRepository } from './auth.repository.js';
import { createAuthService } from './auth.service.js';

const input = { email: 'Auditor@IFTM.edu.br', name: ' Auditor ', password: 'senha-bem-longa-123' };

function setup() {
  const db = createTestDatabase();
  return { db, service: createAuthService(createAuthRepository(db)) };
}

describe('createAuditor', () => {
  it('normaliza os dados e guarda a senha só como hash argon2id', async () => {
    const { db, service } = setup();
    const created = await service.createAuditor(input);

    expect(created).toMatchObject({ email: 'auditor@iftm.edu.br', name: 'Auditor' });
    const row = db.select().from(users).where(eq(users.id, created.id)).get();
    expect(row?.passwordHash).toMatch(/^\$argon2id\$/);
    expect(row?.passwordHash).not.toContain(input.password);
  });

  it('exige senha com pelo menos 6 caracteres', async () => {
    const { service } = setup();
    await expect(service.createAuditor({ ...input, password: 'curta' })).rejects.toThrow(
      /6 caracteres/,
    );
    await expect(
      service.createAuditor({ ...input, email: 'seis@iftm.edu.br', password: 'abc123' }),
    ).resolves.toMatchObject({ email: 'seis@iftm.edu.br' });
  });

  it('recusa e-mail repetido', async () => {
    const { service } = setup();
    await service.createAuditor(input);
    await expect(
      service.createAuditor({ ...input, email: 'auditor@iftm.edu.br' }),
    ).rejects.toMatchObject({ status: 409, code: 'EMAIL_TAKEN' });
  });
});

describe('login', () => {
  it('guarda no banco só o hash do token de sessão', async () => {
    const { db, service } = setup();
    await service.createAuditor(input);
    const { token } = await service.login({
      email: 'auditor@iftm.edu.br',
      password: input.password,
    });

    const [session] = db.select().from(sessions).all();
    expect(session?.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(session?.tokenHash).not.toBe(token);
    expect(service.authenticate(token)?.email).toBe('auditor@iftm.edu.br');
  });
});
