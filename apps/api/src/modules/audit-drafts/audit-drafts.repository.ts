import type { AuditDraftScope, AuditDraftStep } from '@auditoria-rf/contracts';
import { eq } from 'drizzle-orm';
import type { DB } from '../../db/client.js';
import { auditDrafts } from '../../db/schema.js';

export interface AuditDraftRow {
  scope: AuditDraftScope;
  step: AuditDraftStep;
  institutionId: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export function createAuditDraftsRepository(db: DB) {
  return {
    find(userId: number): AuditDraftRow | undefined {
      const row = db.select().from(auditDrafts).where(eq(auditDrafts.createdBy, userId)).get();
      return (
        row && {
          scope: row.scopeJson as AuditDraftScope,
          step: row.step,
          institutionId: row.institutionId,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        }
      );
    },

    /** Cria o rascunho do auditor ou troca o escopo do que já existe (um por auditor). */
    saveScope(userId: number, values: { scope: AuditDraftScope; step: AuditDraftStep; at: Date }) {
      db.insert(auditDrafts)
        .values({
          createdBy: userId,
          scopeJson: values.scope,
          step: values.step,
          institutionId: null,
          createdAt: values.at,
          updatedAt: values.at,
        })
        .onConflictDoUpdate({
          target: auditDrafts.createdBy,
          set: {
            scopeJson: values.scope,
            step: values.step,
            institutionId: null,
            updatedAt: values.at,
          },
        })
        .run();
    },

    savePosition(
      userId: number,
      values: { step: AuditDraftStep; institutionId: number | null; at: Date },
    ) {
      db.update(auditDrafts)
        .set({ step: values.step, institutionId: values.institutionId, updatedAt: values.at })
        .where(eq(auditDrafts.createdBy, userId))
        .run();
    },

    delete(userId: number) {
      db.delete(auditDrafts).where(eq(auditDrafts.createdBy, userId)).run();
    },
  };
}

export type AuditDraftsRepository = ReturnType<typeof createAuditDraftsRepository>;
