import { z } from 'zod';
import { pageFunctionKeys } from './domain.js';

/**
 * Auditoria em montagem (ADR 0017): o que o auditor já escolheu desde "Nova auditoria" fica
 * salvo no servidor, com a etapa em que parou, até a coleta começar ou ele descartar.
 * `scope` = tela 1.1 (escopo); `routes` = tela 1.2 (revisão de rotas).
 */
export const auditDraftSteps = ['scope', 'routes'] as const;
export type AuditDraftStep = (typeof auditDraftSteps)[number];

const ids = z
  .array(z.number().int().positive())
  .max(100)
  .transform((list) => [...new Set(list)]);
const functions = z
  .array(z.enum(pageFunctionKeys))
  .transform((keys) => pageFunctionKeys.filter((key) => keys.includes(key)));

export const auditDraftScopeSchema = z.object({ institutionIds: ids, functions });
export type AuditDraftScope = z.output<typeof auditDraftScopeSchema>;

export const auditDraftSchema = z.object({
  scope: auditDraftScopeSchema,
  step: z.enum(auditDraftSteps),
  /** Instituição cuja revisão de rotas estava aberta; `null` = visão geral ou escopo. */
  institutionId: z.number().int().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AuditDraft = z.infer<typeof auditDraftSchema>;

export const auditDraftResponseSchema = z.object({ draft: auditDraftSchema.nullable() });

/**
 * Salva o escopo. Na etapa `scope` o formulário pode estar pela metade; para seguir à revisão de
 * rotas (`routes`) precisa de ao menos uma instituição e uma página.
 */
export const saveAuditDraftSchema = auditDraftScopeSchema
  .extend({ step: z.enum(auditDraftSteps) })
  .refine(
    (v) => v.step === 'scope' || (v.institutionIds.length > 0 && v.functions.length > 0),
    'Escolha ao menos uma instituição e uma página por instituição.',
  );
export type SaveAuditDraftInput = z.input<typeof saveAuditDraftSchema>;

/** Onde o auditor está no fluxo, para "Nova auditoria" voltar ao mesmo ponto. */
export const auditDraftPositionSchema = z.object({
  step: z.enum(auditDraftSteps),
  institutionId: z.number().int().positive().nullable(),
});
export type AuditDraftPositionInput = z.input<typeof auditDraftPositionSchema>;
