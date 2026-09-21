import { asc, eq } from 'drizzle-orm';
import type { DB } from '../../db/client.js';
import { institutions } from '../../db/schema.js';

export type InstitutionRow = typeof institutions.$inferSelect;
type InstitutionInsert = typeof institutions.$inferInsert;

export function createInstitutionsRepository(db: DB) {
  return {
    list(): InstitutionRow[] {
      return db.select().from(institutions).orderBy(asc(institutions.acronym)).all();
    },

    findById(id: number): InstitutionRow | undefined {
      return db.select().from(institutions).where(eq(institutions.id, id)).get();
    },

    findByDomain(domain: string): InstitutionRow | undefined {
      return db.select().from(institutions).where(eq(institutions.domain, domain)).get();
    },

    insert(values: InstitutionInsert): InstitutionRow {
      return db.insert(institutions).values(values).returning().get();
    },

    update(id: number, values: Partial<InstitutionInsert>): InstitutionRow | undefined {
      return db.update(institutions).set(values).where(eq(institutions.id, id)).returning().get();
    },
  };
}

export type InstitutionsRepository = ReturnType<typeof createInstitutionsRepository>;
