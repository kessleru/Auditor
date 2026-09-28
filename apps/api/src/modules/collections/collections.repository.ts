import type {
  CollectionProgress,
  CollectionScope,
  CollectionStatus,
  PageFunctionKey,
} from '@auditoria-rf/contracts';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import type { DB } from '../../db/client.js';
import {
  collectionPages,
  collections,
  findings,
  functionAbsences,
  institutions,
  pageFunctions,
  routes,
} from '../../db/schema.js';

export type CollectionRow = Omit<typeof collections.$inferSelect, 'scopeJson'> & {
  scope: CollectionScope;
};
type CollectionPageRow = typeof collectionPages.$inferSelect;
export type CollectionPageWithRoute = CollectionPageRow & {
  url: string;
  institutionId: number;
  functionKey: PageFunctionKey | null;
};
export type FindingInsert = Omit<typeof findings.$inferInsert, 'id' | 'collectionPageId'>;

const toCollection = ({ scopeJson, ...row }: typeof collections.$inferSelect): CollectionRow => ({
  ...row,
  scope: scopeJson as CollectionScope,
});

export function createCollectionsRepository(db: DB) {
  const pagesWithRoute = () =>
    db
      .select({
        page: collectionPages,
        url: routes.url,
        institutionId: routes.institutionId,
        functionKey: pageFunctions.key,
      })
      .from(collectionPages)
      .innerJoin(routes, eq(routes.id, collectionPages.routeId))
      .leftJoin(pageFunctions, eq(pageFunctions.id, collectionPages.functionId));

  const flatten = (row: {
    page: CollectionPageRow;
    url: string;
    institutionId: number;
    functionKey: string | null;
  }): CollectionPageWithRoute => ({
    ...row.page,
    url: row.url,
    institutionId: row.institutionId,
    functionKey: row.functionKey as PageFunctionKey | null,
  });

  return {
    transaction<T>(fn: () => T): T {
      return db.transaction(() => fn());
    },

    institutionsByIds(ids: readonly number[]) {
      if (ids.length === 0) return [];
      return db
        .select()
        .from(institutions)
        .where(inArray(institutions.id, [...ids]))
        .all();
    },

    /** Instituições do escopo sem nenhuma rota confirmada para as funções escolhidas. */
    institutionsWithoutRoutes(
      institutionIds: readonly number[],
      functionKeys: readonly PageFunctionKey[] | null,
    ): number[] {
      const withRoutes = new Set(
        this.confirmedRoutesWithInstitution(institutionIds, functionKeys).map(
          (r) => r.institutionId,
        ),
      );
      return institutionIds.filter((id) => !withRoutes.has(id));
    },

    /**
     * Funções do escopo sem decisão do auditor em cada instituição: nem rota confirmada nem
     * marcação de "não encontrada" (ADR 0013).
     */
    unreviewedFunctions(
      institutionIds: readonly number[],
      functionKeys: readonly PageFunctionKey[],
    ): { institutionId: number; functions: PageFunctionKey[] }[] {
      const ids = [...institutionIds];
      const decided = new Set([
        ...db
          .select({ institutionId: routes.institutionId, key: pageFunctions.key })
          .from(routes)
          .innerJoin(pageFunctions, eq(pageFunctions.id, routes.functionId))
          .where(and(inArray(routes.institutionId, ids), eq(routes.status, 'confirmed')))
          .all()
          .map((r) => `${r.institutionId}:${r.key}`),
        ...db
          .select({ institutionId: functionAbsences.institutionId, key: pageFunctions.key })
          .from(functionAbsences)
          .innerJoin(pageFunctions, eq(pageFunctions.id, functionAbsences.functionId))
          .where(inArray(functionAbsences.institutionId, ids))
          .all()
          .map((r) => `${r.institutionId}:${r.key}`),
      ]);
      return ids
        .map((institutionId) => ({
          institutionId,
          functions: functionKeys.filter((key) => !decided.has(`${institutionId}:${key}`)),
        }))
        .filter((gap) => gap.functions.length > 0);
    },

    confirmedRoutesWithInstitution(
      institutionIds: readonly number[],
      functionKeys: readonly PageFunctionKey[] | null,
    ) {
      const conditions = [
        inArray(routes.institutionId, [...institutionIds]),
        eq(routes.status, 'confirmed'),
      ];
      if (functionKeys) conditions.push(inArray(pageFunctions.key, [...functionKeys]));
      return db
        .select({ id: routes.id, institutionId: routes.institutionId })
        .from(routes)
        .leftJoin(pageFunctions, eq(pageFunctions.id, routes.functionId))
        .where(and(...conditions))
        .all();
    },

    confirmedRoutes(
      institutionIds: readonly number[],
      functionKeys: readonly PageFunctionKey[] | null,
    ) {
      const conditions = [
        inArray(routes.institutionId, [...institutionIds]),
        eq(routes.status, 'confirmed'),
      ];
      if (functionKeys) conditions.push(inArray(pageFunctions.key, [...functionKeys]));
      return db
        .select({ id: routes.id, functionId: routes.functionId })
        .from(routes)
        .leftJoin(pageFunctions, eq(pageFunctions.id, routes.functionId))
        .where(and(...conditions))
        .orderBy(asc(routes.institutionId), asc(routes.id))
        .all();
    },

    insertCollection(values: { scope: CollectionScope; createdBy: number }): CollectionRow {
      const row = db
        .insert(collections)
        .values({ scopeJson: values.scope, createdBy: values.createdBy })
        .returning()
        .get();
      return toCollection(row);
    },

    insertPages(
      collectionId: number,
      pages: readonly { routeId: number; functionId: number | null }[],
    ) {
      if (pages.length === 0) return;
      db.insert(collectionPages)
        .values(pages.map((p) => ({ collectionId, routeId: p.routeId, functionId: p.functionId })))
        .run();
    },

    findCollection(id: number): CollectionRow | undefined {
      const row = db.select().from(collections).where(eq(collections.id, id)).get();
      return row && toCollection(row);
    },

    listCollections(statuses?: readonly CollectionStatus[]): CollectionRow[] {
      const query = db.select().from(collections);
      const filtered = statuses ? query.where(inArray(collections.status, [...statuses])) : query;
      return filtered
        .orderBy(desc(collections.createdAt), desc(collections.id))
        .all()
        .map(toCollection);
    },

    listCollectionsByStatus(statuses: readonly CollectionStatus[]): CollectionRow[] {
      return db
        .select()
        .from(collections)
        .where(inArray(collections.status, [...statuses]))
        .orderBy(asc(collections.createdAt), asc(collections.id))
        .all()
        .map(toCollection);
    },

    updateCollection(id: number, values: Partial<typeof collections.$inferInsert>) {
      db.update(collections).set(values).where(eq(collections.id, id)).run();
    },

    progress(collectionId: number): CollectionProgress {
      const rows = db
        .select({ status: collectionPages.status, count: sql<number>`count(*)` })
        .from(collectionPages)
        .where(eq(collectionPages.collectionId, collectionId))
        .groupBy(collectionPages.status)
        .all();
      const progress = { total: 0, queued: 0, running: 0, done: 0, failed: 0 };
      for (const { status, count } of rows) {
        progress[status] = count;
        progress.total += count;
      }
      return progress;
    },

    listPages(collectionId: number): CollectionPageWithRoute[] {
      return pagesWithRoute()
        .where(eq(collectionPages.collectionId, collectionId))
        .orderBy(asc(collectionPages.id))
        .all()
        .map(flatten);
    },

    findPage(id: number): CollectionPageWithRoute | undefined {
      const row = pagesWithRoute().where(eq(collectionPages.id, id)).get();
      return row && flatten(row);
    },

    queuedPages(collectionIds: readonly number[]): CollectionPageWithRoute[] {
      if (collectionIds.length === 0) return [];
      return pagesWithRoute()
        .where(
          and(
            inArray(collectionPages.collectionId, [...collectionIds]),
            eq(collectionPages.status, 'queued'),
          ),
        )
        .orderBy(asc(collectionPages.collectionId), asc(collectionPages.id))
        .all()
        .map(flatten);
    },

    /** Marca a página como em execução só se ainda estiver na fila (reivindicação atômica). */
    claimPage(id: number): boolean {
      const result = db
        .update(collectionPages)
        .set({ status: 'running' })
        .where(and(eq(collectionPages.id, id), eq(collectionPages.status, 'queued')))
        .run();
      return result.changes === 1;
    },

    updatePage(id: number, values: Partial<typeof collectionPages.$inferInsert>) {
      db.update(collectionPages).set(values).where(eq(collectionPages.id, id)).run();
    },

    insertFindings(collectionPageId: number, drafts: readonly FindingInsert[]) {
      if (drafts.length === 0) return [];
      return db
        .insert(findings)
        .values(drafts.map((d) => ({ ...d, collectionPageId })))
        .returning({ id: findings.id, ruleId: findings.ruleId, selector: findings.selector })
        .all();
    },

    setScreenshotPath(findingId: number, screenshotPath: string) {
      db.update(findings).set({ screenshotPath }).where(eq(findings.id, findingId)).run();
    },

    /** Retomada após reinício: o que estava em execução volta para a fila. */
    resetInterrupted() {
      db.transaction((tx) => {
        tx.update(collectionPages)
          .set({ status: 'queued' })
          .where(eq(collectionPages.status, 'running'))
          .run();
        tx.update(collections)
          .set({ status: 'queued' })
          .where(eq(collections.status, 'running'))
          .run();
      });
    },
  };
}

export type CollectionsRepository = ReturnType<typeof createCollectionsRepository>;
