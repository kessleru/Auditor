import type {
  AuditDraft,
  auditDraftPositionSchema,
  saveAuditDraftSchema,
} from '@auditoria-rf/contracts';
import type { z } from 'zod';
import { AppError, NotFoundError } from '../../shared/errors.js';
import type { CollectionsService } from '../collections/collections.service.js';
import type { InstitutionsService } from '../institutions/institutions.service.js';
import type { DiscoveryService } from '../routes-discovery/discovery.service.js';
import type { AuditDraftRow, AuditDraftsRepository } from './audit-drafts.repository.js';

type SaveDraft = z.output<typeof saveAuditDraftSchema>;
type DraftPosition = z.output<typeof auditDraftPositionSchema>;

const toDraft = (row: AuditDraftRow): AuditDraft => ({
  scope: row.scope,
  step: row.step,
  institutionId: row.institutionId,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

/**
 * Auditoria em montagem (ADR 0017): o escopo e a etapa em que o auditor parou ficam salvos até a
 * coleta começar ou ele descartar. Confirmar o escopo põe na fila a descoberta das instituições
 * que ainda não foram olhadas; ela roda em segundo plano enquanto o auditor revisa as outras.
 */
export function createAuditDraftsService(
  repo: AuditDraftsRepository,
  {
    institutions,
    discovery,
    collections,
  }: {
    institutions: InstitutionsService;
    discovery: DiscoveryService;
    collections: CollectionsService;
  },
  { now = () => new Date() }: { now?: () => Date } = {},
) {
  const requireDraft = (userId: number) => {
    const row = repo.find(userId);
    if (!row) throw new NotFoundError('Nenhuma auditoria em montagem.');
    return row;
  };

  return {
    get(userId: number): AuditDraft | null {
      const row = repo.find(userId);
      return row ? toDraft(row) : null;
    },

    save(userId: number, { step, institutionIds, functions }: SaveDraft): AuditDraft {
      const known = new Set(institutions.list().map((i) => i.id));
      const missing = institutionIds.filter((id) => !known.has(id));
      if (missing.length > 0) {
        throw new NotFoundError(`Instituição não encontrada: ${missing.join(', ')}.`);
      }
      repo.saveScope(userId, { scope: { institutionIds, functions }, step, at: now() });
      if (step === 'routes') discovery.startMissing(institutionIds, userId);
      return toDraft(requireDraft(userId));
    },

    /** Onde o auditor está: "Nova auditoria" volta para cá. */
    move(userId: number, { step, institutionId }: DraftPosition): AuditDraft {
      const row = requireDraft(userId);
      if (institutionId !== null && !row.scope.institutionIds.includes(institutionId)) {
        throw new AppError(
          422,
          'NOT_IN_SCOPE',
          'A instituição não está no escopo desta auditoria.',
        );
      }
      repo.savePosition(userId, { step, institutionId, at: now() });
      return toDraft(requireDraft(userId));
    },

    discard(userId: number) {
      repo.delete(userId);
    },

    /** Cria a coleta com o escopo salvo; o rascunho só sai quando a coleta foi criada. */
    start(userId: number) {
      const { scope } = requireDraft(userId);
      if (scope.institutionIds.length === 0 || scope.functions.length === 0) {
        throw new AppError(
          422,
          'INCOMPLETE_SCOPE',
          'Escolha ao menos uma instituição e uma página por instituição.',
        );
      }
      const collection = collections.create(scope, userId);
      repo.delete(userId);
      return collection;
    },
  };
}

export type AuditDraftsService = ReturnType<typeof createAuditDraftsService>;
