import type { AuthUser } from '@auditoria-rf/contracts';
import { and, eq, gt, lte, ne } from 'drizzle-orm';
import type { DB } from '../../db/client.js';
import { sessions, users } from '../../db/schema.js';
import { DEMO_AUDITOR } from '../../shared/demo.js';

const authUserColumns = { id: users.id, email: users.email, name: users.name };

export function createAuthRepository(db: DB) {
  return {
    findUserByEmail(email: string) {
      return db.select().from(users).where(eq(users.email, email)).get();
    },

    /** Auditores de verdade: a conta que assina a demonstração fica de fora (ADR 0015). */
    listUsers(): AuthUser[] {
      return db
        .select(authUserColumns)
        .from(users)
        .where(ne(users.email, DEMO_AUDITOR.email))
        .orderBy(users.id)
        .all();
    },

    insertUser(values: { email: string; name: string; passwordHash: string }): AuthUser {
      return db.insert(users).values(values).returning(authUserColumns).get();
    },

    insertSession(values: { userId: number; tokenHash: string; expiresAt: Date }) {
      db.insert(sessions).values(values).run();
    },

    findUserBySession(tokenHash: string, now: Date): AuthUser | undefined {
      return db
        .select(authUserColumns)
        .from(sessions)
        .innerJoin(users, eq(users.id, sessions.userId))
        .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now)))
        .get();
    },

    deleteSession(tokenHash: string) {
      db.delete(sessions).where(eq(sessions.tokenHash, tokenHash)).run();
    },

    deleteExpiredSessions(now: Date) {
      db.delete(sessions).where(lte(sessions.expiresAt, now)).run();
    },
  };
}

export type AuthRepository = ReturnType<typeof createAuthRepository>;
