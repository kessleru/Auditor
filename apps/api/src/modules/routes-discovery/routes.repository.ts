import type { PageFunctionKey, RouteStatus } from '@auditoria-rf/contracts';
import { and, asc, eq } from 'drizzle-orm';
import type { DB } from '../../db/client.js';
import { pageFunctions, routes } from '../../db/schema.js';

export type RouteRow = typeof routes.$inferSelect;
type RouteInsert = typeof routes.$inferInsert;
export type RouteWithFunction = RouteRow & { functionKey: PageFunctionKey | null };

export function createRoutesRepository(db: DB) {
  const withFunction = () =>
    db
      .select({ route: routes, functionKey: pageFunctions.key })
      .from(routes)
      .leftJoin(pageFunctions, eq(pageFunctions.id, routes.functionId));

  const flatten = (row: { route: RouteRow; functionKey: string | null }): RouteWithFunction => ({
    ...row.route,
    functionKey: row.functionKey as PageFunctionKey | null,
  });

  return {
    listByInstitution(institutionId: number, status?: RouteStatus): RouteWithFunction[] {
      const where = status
        ? and(eq(routes.institutionId, institutionId), eq(routes.status, status))
        : eq(routes.institutionId, institutionId);
      return withFunction().where(where).orderBy(asc(routes.normalizedUrl)).all().map(flatten);
    },

    findById(id: number): RouteWithFunction | undefined {
      const row = withFunction().where(eq(routes.id, id)).get();
      return row && flatten(row);
    },

    findByNormalizedUrl(institutionId: number, normalizedUrl: string): RouteRow | undefined {
      return db
        .select()
        .from(routes)
        .where(
          and(eq(routes.institutionId, institutionId), eq(routes.normalizedUrl, normalizedUrl)),
        )
        .get();
    },

    insert(values: RouteInsert): RouteRow {
      return db.insert(routes).values(values).returning().get();
    },

    update(id: number, values: Partial<RouteInsert>) {
      db.update(routes).set(values).where(eq(routes.id, id)).run();
    },

    functionIdsByKey(): Map<PageFunctionKey, number> {
      const rows = db
        .select({ id: pageFunctions.id, key: pageFunctions.key })
        .from(pageFunctions)
        .all();
      return new Map(rows.map((r) => [r.key as PageFunctionKey, r.id]));
    },

    transaction<T>(fn: () => T): T {
      return db.transaction(() => fn());
    },
  };
}

export type RoutesRepository = ReturnType<typeof createRoutesRepository>;
