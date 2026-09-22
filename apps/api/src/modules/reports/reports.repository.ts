import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import type { DB } from '../../db/client.js';
import { collectionPages, collections, findings, institutions, routes } from '../../db/schema.js';

const FINISHED = ['completed', 'partial'] as const;

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

    /** Coletas terminadas (completas ou parciais) que incluíram a instituição, da mais antiga à mais recente. */
    finishedCollectionsOf(institutionId: number) {
      return db
        .select({
          id: collections.id,
          finishedAt: collections.finishedAt,
          axeVersion: collections.axeVersion,
          browserVersion: collections.browserVersion,
        })
        .from(collections)
        .where(
          and(
            inArray(collections.status, [...FINISHED]),
            sql`exists (select 1 from json_each(${collections.scopeJson}, '$.institutionIds') where value = ${institutionId})`,
          ),
        )
        .orderBy(asc(collections.finishedAt), asc(collections.id))
        .all();
    },

    lastFinishedCollection() {
      return db
        .select({
          id: collections.id,
          finishedAt: collections.finishedAt,
          axeVersion: collections.axeVersion,
          browserVersion: collections.browserVersion,
        })
        .from(collections)
        .where(inArray(collections.status, [...FINISHED]))
        .orderBy(desc(collections.finishedAt), desc(collections.id))
        .get();
    },

    activeInstitutions() {
      return db
        .select()
        .from(institutions)
        .where(eq(institutions.active, true))
        .orderBy(asc(institutions.acronym))
        .all();
    },

    findInstitution(id: number) {
      return db.select().from(institutions).where(eq(institutions.id, id)).get();
    },

    /** Achados com o contexto necessário para exibir (página, trecho, ajuda). */
    findingDetailsOf(collectionId: number, institutionId: number) {
      return db
        .select({
          collectionPageId: findings.collectionPageId,
          fingerprint: findings.fingerprint,
          ruleId: findings.ruleId,
          wcagCriteria: findings.wcagCriteria,
          principle: findings.principle,
          severity: findings.severity,
          validation: findings.validation,
          selector: findings.selector,
          htmlSnippet: findings.htmlSnippet,
          help: findings.help,
          helpUrl: findings.helpUrl,
          pageUrl: routes.url,
        })
        .from(findings)
        .innerJoin(collectionPages, eq(collectionPages.id, findings.collectionPageId))
        .innerJoin(routes, eq(routes.id, collectionPages.routeId))
        .where(
          and(
            eq(collectionPages.collectionId, collectionId),
            eq(routes.institutionId, institutionId),
          ),
        )
        .orderBy(asc(findings.id))
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
