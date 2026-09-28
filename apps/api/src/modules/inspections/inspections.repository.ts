import type {
  AssistiveCheckKind,
  AssistiveCheckState,
  PageFunctionKey,
  Severity,
} from '@auditoria-rf/contracts';
import { and, asc, eq, inArray, notInArray } from 'drizzle-orm';
import type { DB } from '../../db/client.js';
import {
  assistiveChecks,
  collectionPages,
  collections,
  findings,
  inspectionSample,
  institutions,
  pageFunctions,
  routes,
  targetTasks,
  taskInspections,
} from '../../db/schema.js';

export function createInspectionsRepository(db: DB) {
  return {
    transaction<T>(fn: () => T): T {
      return db.transaction(() => fn());
    },

    collection(id: number) {
      return db.select().from(collections).where(eq(collections.id, id)).get();
    },

    /** Páginas da coleta com rota, instituição e função. */
    pagesOf(collectionId: number, institutionId?: number) {
      const conditions = [eq(collectionPages.collectionId, collectionId)];
      if (institutionId !== undefined) conditions.push(eq(routes.institutionId, institutionId));
      return db
        .select({
          id: collectionPages.id,
          status: collectionPages.status,
          url: routes.url,
          institutionId: routes.institutionId,
          functionKey: pageFunctions.key,
        })
        .from(collectionPages)
        .innerJoin(routes, eq(routes.id, collectionPages.routeId))
        .leftJoin(pageFunctions, eq(pageFunctions.id, collectionPages.functionId))
        .where(and(...conditions))
        .orderBy(asc(collectionPages.id))
        .all()
        .map((p) => ({ ...p, functionKey: p.functionKey as PageFunctionKey | null }));
    },

    institutionsByIds(ids: readonly number[]) {
      if (ids.length === 0) return [];
      return db
        .select()
        .from(institutions)
        .where(inArray(institutions.id, [...ids]))
        .orderBy(asc(institutions.acronym))
        .all();
    },

    sampleIds(collectionId: number): number[] {
      return db
        .select({ id: inspectionSample.institutionId })
        .from(inspectionSample)
        .where(eq(inspectionSample.collectionId, collectionId))
        .all()
        .map((r) => r.id);
    },

    setSample(collectionId: number, institutionIds: readonly number[], selectedBy: number) {
      db.transaction((tx) => {
        const keep = [...institutionIds];
        tx.delete(inspectionSample)
          .where(
            keep.length > 0
              ? and(
                  eq(inspectionSample.collectionId, collectionId),
                  notInArray(inspectionSample.institutionId, keep),
                )
              : eq(inspectionSample.collectionId, collectionId),
          )
          .run();
        for (const institutionId of keep) {
          tx.insert(inspectionSample)
            .values({ collectionId, institutionId, selectedBy })
            .onConflictDoNothing()
            .run();
        }
      });
    },

    findingsOf(collectionId: number, institutionId: number) {
      return db
        .select({
          id: findings.id,
          collectionPageId: findings.collectionPageId,
          fingerprint: findings.fingerprint,
          ruleId: findings.ruleId,
          wcagCriteria: findings.wcagCriteria,
          principle: findings.principle,
          severity: findings.severity,
          validation: findings.validation,
          validationNote: findings.validationNote,
          selector: findings.selector,
          htmlSnippet: findings.htmlSnippet,
          screenshotPath: findings.screenshotPath,
          evidenceJson: findings.evidenceJson,
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

    activeTasks(functionKeys: readonly PageFunctionKey[] | null) {
      const conditions = [eq(targetTasks.active, true)];
      if (functionKeys) conditions.push(inArray(pageFunctions.key, [...functionKeys]));
      return db
        .select({
          id: targetTasks.id,
          title: targetTasks.title,
          description: targetTasks.description,
          active: targetTasks.active,
          functionKey: pageFunctions.key,
        })
        .from(targetTasks)
        .innerJoin(pageFunctions, eq(pageFunctions.id, targetTasks.functionId))
        .where(and(...conditions))
        .orderBy(asc(targetTasks.id))
        .all()
        .map((t) => ({ ...t, functionKey: t.functionKey as PageFunctionKey }));
    },

    allTasks() {
      return db
        .select({
          id: targetTasks.id,
          title: targetTasks.title,
          description: targetTasks.description,
          active: targetTasks.active,
          functionKey: pageFunctions.key,
        })
        .from(targetTasks)
        .innerJoin(pageFunctions, eq(pageFunctions.id, targetTasks.functionId))
        .orderBy(asc(targetTasks.id))
        .all()
        .map((t) => ({ ...t, functionKey: t.functionKey as PageFunctionKey }));
    },

    functionId(key: PageFunctionKey) {
      return db
        .select({ id: pageFunctions.id })
        .from(pageFunctions)
        .where(eq(pageFunctions.key, key))
        .get()?.id;
    },

    insertTask(values: typeof targetTasks.$inferInsert) {
      return db.insert(targetTasks).values(values).returning().get();
    },

    taskInspectionsOf(collectionId: number, institutionId: number) {
      return db
        .select()
        .from(taskInspections)
        .where(
          and(
            eq(taskInspections.collectionId, collectionId),
            eq(taskInspections.institutionId, institutionId),
          ),
        )
        .all();
    },

    /** Uma inspeção por tarefa, portal e coleta: salvar de novo substitui a anterior. */
    upsertTaskInspection(values: typeof taskInspections.$inferInsert) {
      const { collectionId: _c, institutionId: _i, taskId: _t, ...rest } = values;
      return db
        .insert(taskInspections)
        .values(values)
        .onConflictDoUpdate({
          target: [
            taskInspections.collectionId,
            taskInspections.institutionId,
            taskInspections.taskId,
          ],
          set: rest,
        })
        .returning()
        .get();
    },

    assistiveChecksOf(pageIds: readonly number[]) {
      if (pageIds.length === 0) return [];
      return db
        .select()
        .from(assistiveChecks)
        .where(inArray(assistiveChecks.collectionPageId, [...pageIds]))
        .all();
    },

    upsertAssistiveCheck(values: {
      collectionPageId: number;
      kind: AssistiveCheckKind;
      state: AssistiveCheckState;
      severity: Severity | null;
      note: string | null;
      inspectorId: number;
    }) {
      const { collectionPageId: _p, kind: _k, ...rest } = values;
      return db
        .insert(assistiveChecks)
        .values(values)
        .onConflictDoUpdate({
          target: [assistiveChecks.collectionPageId, assistiveChecks.kind],
          set: rest,
        })
        .returning()
        .get();
    },

    pageWithCollection(pageId: number) {
      return db
        .select({
          id: collectionPages.id,
          collectionId: collectionPages.collectionId,
          status: collectionPages.status,
          institutionId: routes.institutionId,
        })
        .from(collectionPages)
        .innerJoin(routes, eq(routes.id, collectionPages.routeId))
        .where(eq(collectionPages.id, pageId))
        .get();
    },

    findingWithCollection(findingId: number) {
      return db
        .select({
          id: findings.id,
          fingerprint: findings.fingerprint,
          validation: findings.validation,
          collectionId: collectionPages.collectionId,
          institutionId: routes.institutionId,
        })
        .from(findings)
        .innerJoin(collectionPages, eq(collectionPages.id, findings.collectionPageId))
        .innerJoin(routes, eq(routes.id, collectionPages.routeId))
        .where(eq(findings.id, findingId))
        .get();
    },

    /** Validação vale para todos os achados do mesmo problema (fingerprint) na coleta. */
    validateProblem(
      collectionId: number,
      fingerprint: string,
      values: {
        validation: 'confirmed' | 'false_positive';
        validationNote: string | null;
        validatedBy: number;
        validatedAt: Date;
      },
    ) {
      const pageIds = db
        .select({ id: collectionPages.id })
        .from(collectionPages)
        .where(eq(collectionPages.collectionId, collectionId))
        .all()
        .map((p) => p.id);
      db.update(findings)
        .set(values)
        .where(
          and(eq(findings.fingerprint, fingerprint), inArray(findings.collectionPageId, pageIds)),
        )
        .run();
    },
  };
}

export type InspectionsRepository = ReturnType<typeof createInspectionsRepository>;
