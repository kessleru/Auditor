import { z } from 'zod';
import { assistiveCheckKinds, heuristics, severities, taskResults } from './domain.js';
import {
  conformityHistoryEntrySchema,
  publicInstitutionSchema,
  publicProblemSchema,
} from './public.js';

// Resultados do auditor (telas 4.1, 4.2 e 4.3; ADR 0009). Mesma regra de coleta da visão pública,
// mas os problemas contam tudo que não é falso positivo, e a camada manual aparece junto.

export const inspectionStatuses = ['not_started', 'in_progress', 'done', 'not_in_sample'] as const;

export const auditorInstitutionSchema = publicInstitutionSchema.extend({
  /** Situação na camada manual da coleta exibida; `null` quando não há dado. */
  inspection: z.enum(inspectionStatuses).nullable(),
  tasks: z.object({ done: z.number().int(), total: z.number().int() }).nullable(),
});
export type AuditorInstitution = z.infer<typeof auditorInstitutionSchema>;

export const resultsOverviewSchema = z.object({
  lastCollectionAt: z.string().nullable(),
  institutionsTotal: z.number().int(),
  institutionsEvaluated: z.number().int(),
  averageConformity: z.number().nullable(),
  distinctProblems: z.number().int(),
  tasks: z.object({ done: z.number().int(), total: z.number().int() }),
  institutions: z.array(auditorInstitutionSchema),
});
export type ResultsOverview = z.infer<typeof resultsOverviewSchema>;

export const manualTaskFindingSchema = z.object({
  taskTitle: z.string(),
  taskDescription: z.string(),
  result: z.enum(taskResults),
  heuristic: z.enum(heuristics).nullable(),
  severity: z.enum(severities).nullable(),
  interactions: z.number().int(),
  durationSeconds: z.number().int(),
  path: z.array(z.string()),
  note: z.string(),
});

export const manualBarrierSchema = z.object({
  pageUrl: z.string(),
  kind: z.enum(assistiveCheckKinds),
  severity: z.enum(severities).nullable(),
  note: z.string().nullable(),
});

export const auditorInstitutionDetailSchema = z.object({
  institution: auditorInstitutionSchema,
  history: z.array(conformityHistoryEntrySchema),
  problems: z.array(publicProblemSchema),
  manual: z.object({
    tasks: z.array(manualTaskFindingSchema),
    barriers: z.array(manualBarrierSchema),
  }),
});
export type AuditorInstitutionDetail = z.infer<typeof auditorInstitutionDetailSchema>;
