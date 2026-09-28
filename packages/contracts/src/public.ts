import { z } from 'zod';
import { conformityClasses } from './conformity.js';
import { findingValidations, pageFunctionKeys, severities, wcagPrinciples } from './domain.js';
import { findingExampleSchema } from './findings.js';

// Visão pública (somente leitura). Cada instituição aparece com a sua coleta mais recente
// terminada; se falhou nela, é ausência de dado (ADR 0006).

export const publicInstitutionStatuses = ['evaluated', 'no_data', 'not_collected'] as const;

export const publicInstitutionSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  acronym: z.string(),
  domain: z.string(),
  status: z.enum(publicInstitutionStatuses),
  collectionId: z.number().int().nullable(),
  collectedAt: z.string().nullable(),
  // Conformidade e problemas medidos no NÚCLEO COMUM: as funções avaliadas em todas as
  // instituições comparadas (ADR 0013). É o que entra no ranking.
  conformity: z.number().nullable(),
  classification: z.enum(conformityClasses).nullable(),
  /** Problemas distintos confirmados pelo auditor, nas páginas do núcleo comum. */
  problems: z.number().int().nullable(),
  criticalProblems: z.number().int().nullable(),
  templateProblems: z.number().int().nullable(),
  /** Achados ainda aguardando a validação manual. */
  pendingValidation: z.number().int(),
  /** Páginas avaliadas no núcleo comum. */
  pagesEvaluated: z.number().int(),
  pagesTotal: z.number().int(),
  /** Funções do escopo encontradas no portal; `null` em coleta antiga ou sem coleta. */
  coverage: z
    .object({
      found: z.number().int(),
      expected: z.number().int(),
      missing: z.array(z.enum(pageFunctionKeys)),
    })
    .nullable(),
  /** Todas as páginas avaliadas da instituição, dentro e fora do núcleo comum. */
  overall: z
    .object({
      conformity: z.number().nullable(),
      problems: z.number().int(),
      pagesEvaluated: z.number().int(),
    })
    .nullable(),
});
export type PublicInstitution = z.infer<typeof publicInstitutionSchema>;

/** Funções avaliadas em todas as instituições comparadas: a base do ranking (ADR 0013). */
export const coreFunctionsSchema = z.array(z.enum(pageFunctionKeys));

export const publicInstitutionListResponseSchema = z.object({
  institutions: z.array(publicInstitutionSchema),
  coreFunctions: coreFunctionsSchema,
});

export const publicSummarySchema = z.object({
  lastCollectionAt: z.string().nullable(),
  institutionsTotal: z.number().int(),
  institutionsEvaluated: z.number().int(),
  /** Média da conformidade no núcleo comum, só entre as avaliadas. */
  averageConformity: z.number().nullable(),
  coreFunctions: coreFunctionsSchema,
});
export type PublicSummary = z.infer<typeof publicSummarySchema>;

export const conformityHistoryEntrySchema = z.object({
  collectionId: z.number().int(),
  collectedAt: z.string(),
  conformity: z.number().nullable(),
});

export const publicInstitutionDetailSchema = z.object({
  institution: publicInstitutionSchema,
  /** Coletas terminadas que incluíram a instituição, da mais antiga para a mais recente. */
  history: z.array(conformityHistoryEntrySchema),
});
export type PublicInstitutionDetail = z.infer<typeof publicInstitutionDetailSchema>;

export const publicProblemSchema = z.object({
  fingerprint: z.string(),
  ruleId: z.string(),
  /** Título e descrição da regra em português (textos do axe-core). */
  title: z.string(),
  description: z.string(),
  helpUrl: z.string(),
  wcagCriteria: z.string(),
  principle: z.enum(wcagPrinciples),
  severity: z.enum(severities),
  /** Na visão pública, sempre `confirmed`. */
  validation: z.enum(findingValidations),
  template: z.boolean(),
  pages: z.number().int(),
  occurrences: z.number().int(),
  example: findingExampleSchema,
});
export type PublicProblem = z.infer<typeof publicProblemSchema>;

export const publicFindingsResponseSchema = z.object({ problems: z.array(publicProblemSchema) });

export const methodologySchema = z.object({
  axeVersion: z.string().nullable(),
  browserVersion: z.string().nullable(),
  lastCollectionAt: z.string().nullable(),
  axeTags: z.array(z.string()),
  thresholds: z.object({ good: z.number(), partial: z.number() }),
  templateThreshold: z.number(),
  templateMinPages: z.number().int(),
  contactEmail: z.string().nullable(),
});
export type Methodology = z.infer<typeof methodologySchema>;
