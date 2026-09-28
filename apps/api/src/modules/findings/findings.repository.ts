import { eq } from 'drizzle-orm';
import type { DB } from '../../db/client.js';
import { findings } from '../../db/schema.js';

export function createFindingsRepository(db: DB) {
  return {
    screenshotOf(id: number) {
      return db
        .select({ validation: findings.validation, screenshotPath: findings.screenshotPath })
        .from(findings)
        .where(eq(findings.id, id))
        .get();
    },
  };
}

export type FindingsRepository = ReturnType<typeof createFindingsRepository>;
