import { asc, eq } from 'drizzle-orm';
import type { DB } from '../../db/client.js';
import { collectionPages, findings, institutions, routes } from '../../db/schema.js';

export function createReportsRepository(db: DB) {
  return {
    pagesOfCollection(collectionId: number) {
      return db
        .select({
          id: collectionPages.id,
          status: collectionPages.status,
          passesCount: collectionPages.passesCount,
          violationsCount: collectionPages.violationsCount,
          incompleteCount: collectionPages.incompleteCount,
          institutionId: routes.institutionId,
        })
        .from(collectionPages)
        .innerJoin(routes, eq(routes.id, collectionPages.routeId))
        .where(eq(collectionPages.collectionId, collectionId))
        .orderBy(asc(collectionPages.id))
        .all();
    },

    findingsOfCollection(collectionId: number) {
      return db
        .select({
          collectionPageId: findings.collectionPageId,
          fingerprint: findings.fingerprint,
          ruleId: findings.ruleId,
          wcagCriteria: findings.wcagCriteria,
          severity: findings.severity,
          validation: findings.validation,
        })
        .from(findings)
        .innerJoin(collectionPages, eq(collectionPages.id, findings.collectionPageId))
        .where(eq(collectionPages.collectionId, collectionId))
        .all();
    },

    institution(id: number) {
      return db
        .select({ id: institutions.id, acronym: institutions.acronym, name: institutions.name })
        .from(institutions)
        .where(eq(institutions.id, id))
        .get();
    },
  };
}

export type ReportsRepository = ReturnType<typeof createReportsRepository>;
