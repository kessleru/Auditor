import type { FindingEvidence } from '@auditoria-rf/contracts';
import { and, asc, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import type { DB } from '../../db/client.js';
import { collectionPages, findings } from '../../db/schema.js';

export function createFindingsRepository(db: DB) {
  return {
    screenshotOf(id: number) {
      return db
        .select({ validation: findings.validation, screenshotPath: findings.screenshotPath })
        .from(findings)
        .where(eq(findings.id, id))
        .get();
    },

    /** Páginas avaliadas com resultado do axe salvo (de uma coleta ou de todas). */
    evaluatedPages(collectionId?: number) {
      return db
        .select({ id: collectionPages.id, snapshotPath: collectionPages.snapshotPath })
        .from(collectionPages)
        .where(
          and(
            eq(collectionPages.status, 'done'),
            isNotNull(collectionPages.snapshotPath),
            collectionId === undefined ? undefined : eq(collectionPages.collectionId, collectionId),
          ),
        )
        .orderBy(asc(collectionPages.id))
        .all() as { id: number; snapshotPath: string }[];
    },

    /** Achados da página ainda sem evidência, das regras dadas. */
    findingsWithoutEvidence(pageId: number, ruleIds: readonly string[]) {
      return db
        .select({ id: findings.id, ruleId: findings.ruleId, selector: findings.selector })
        .from(findings)
        .where(
          and(
            eq(findings.collectionPageId, pageId),
            isNull(findings.evidenceJson),
            inArray(findings.ruleId, [...ruleIds]),
          ),
        )
        .all();
    },

    setEvidence(id: number, evidence: FindingEvidence) {
      db.update(findings).set({ evidenceJson: evidence }).where(eq(findings.id, id)).run();
    },
  };
}

export type FindingsRepository = ReturnType<typeof createFindingsRepository>;
