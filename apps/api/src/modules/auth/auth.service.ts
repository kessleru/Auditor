import { createHash, randomBytes } from 'node:crypto';
import type { AuthUser, LoginRequest } from '@auditoria-rf/contracts';
import argon2 from 'argon2';
import { AppError } from '../../shared/errors.js';
import type { AuthRepository } from './auth.repository.js';
import { type CreateAuditorInput, createAuditorSchema } from './auth.schemas.js';

export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export interface AuthServiceOptions {
  now?: () => Date;
}

export function createAuthService(
  repo: AuthRepository,
  { now = () => new Date() }: AuthServiceOptions = {},
) {
  // Hash fictício para gastar o mesmo tempo quando o e-mail não existe (evita enumeração por tempo).
  let dummyHash: Promise<string> | undefined;
  const getDummyHash = () => (dummyHash ??= argon2.hash(randomBytes(16).toString('hex')));

  return {
    async login({ email, password }: LoginRequest) {
      const user = repo.findUserByEmail(email);
      const valid = user
        ? await argon2.verify(user.passwordHash, password)
        : await argon2.verify(await getDummyHash(), password).then(() => false);

      if (!user || !valid) {
        throw new AppError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha incorretos.');
      }

      const current = now();
      const token = randomBytes(32).toString('base64url');
      const expiresAt = new Date(current.getTime() + SESSION_TTL_MS);
      repo.deleteExpiredSessions(current);
      repo.insertSession({ userId: user.id, tokenHash: hashToken(token), expiresAt });

      const authUser: AuthUser = { id: user.id, email: user.email, name: user.name };
      return { user: authUser, token, expiresAt };
    },

    authenticate(token: string | undefined): AuthUser | null {
      if (!token) return null;
      return repo.findUserBySession(hashToken(token), now()) ?? null;
    },

    logout(token: string | undefined) {
      if (token) repo.deleteSession(hashToken(token));
    },

    listAuditors(): AuthUser[] {
      return repo.listUsers();
    },

    async createAuditor(input: CreateAuditorInput): Promise<AuthUser> {
      const { email, name, password } = createAuditorSchema.parse(input);
      if (repo.findUserByEmail(email)) {
        throw new AppError(409, 'EMAIL_TAKEN', `Já existe um auditor com o e-mail ${email}.`);
      }
      const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
      return repo.insertUser({ email, name, passwordHash });
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
