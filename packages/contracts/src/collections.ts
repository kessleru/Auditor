import { z } from 'zod';
import { collectionPageStatuses, collectionStatuses, pageFunctionKeys } from './domain.js';

export const createCollectionSchema = z.object({
  institutionIds: z
    .array(z.number().int().positive())
    .min(1, 'Escolha ao menos uma instituição.')
    .max(100)
    .transform((ids) => [...new Set(ids)]),
  /** Sem `functions`, entram todas as rotas confirmadas das instituições. */
  functions: z
    .array(z.enum(pageFunctionKeys))
    .min(1)
    .transform((keys) => [...new Set(keys)])
    .optional(),
});
export type CreateCollectionInput = z.input<typeof createCollectionSchema>;

export const collectionScopeSchema = z.object({
  institutionIds: z.array(z.number().int()),
  functions: z.array(z.enum(pageFunctionKeys)).nullable(),
});
export type CollectionScope = z.infer<typeof collectionScopeSchema>;

export const collectionProgressSchema = z.object({
  total: z.number().int(),
  queued: z.number().int(),
  running: z.number().int(),
  done: z.number().int(),
  failed: z.number().int(),
});
export type CollectionProgress = z.infer<typeof collectionProgressSchema>;

export const collectionSchema = z.object({
  id: z.number().int(),
  status: z.enum(collectionStatuses),
  scope: collectionScopeSchema,
  axeVersion: z.string().nullable(),
  browserVersion: z.string().nullable(),
  userAgent: z.string().nullable(),
  createdBy: z.number().int(),
  createdAt: z.string(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  progress: collectionProgressSchema,
});
export type Collection = z.infer<typeof collectionSchema>;

export const collectionPageSchema = z.object({
  id: z.number().int(),
  collectionId: z.number().int(),
  routeId: z.number().int(),
  institutionId: z.number().int(),
  url: z.string(),
  functionKey: z.enum(pageFunctionKeys).nullable(),
  status: z.enum(collectionPageStatuses),
  httpStatus: z.number().int().nullable(),
  error: z.string().nullable(),
  passesCount: z.number().int(),
  violationsCount: z.number().int(),
  incompleteCount: z.number().int(),
  inapplicableCount: z.number().int(),
  evaluatedAt: z.string().nullable(),
});
export type CollectionPage = z.infer<typeof collectionPageSchema>;

export const collectionInstitutionSchema = z.object({
  id: z.number().int(),
  acronym: z.string(),
  name: z.string(),
});

export const collectionListItemSchema = collectionSchema.extend({
  institutions: z.array(collectionInstitutionSchema),
});
export type CollectionListItem = z.infer<typeof collectionListItemSchema>;

export const collectionListQuerySchema = z.object({
  /** Situações separadas por vírgula, ex.: `queued,running`. */
  status: z
    .string()
    .optional()
    .transform((value) => (value ? value.split(',').map((s) => s.trim()) : undefined))
    .pipe(z.array(z.enum(collectionStatuses)).optional()),
});

export const collectionListResponseSchema = z.object({
  collections: z.array(collectionListItemSchema),
});

export const collectionResponseSchema = z.object({ collection: collectionSchema });
export const collectionDetailResponseSchema = z.object({
  collection: collectionSchema,
  institutions: z.array(collectionInstitutionSchema),
  pages: z.array(collectionPageSchema),
});
export const collectionPageResponseSchema = z.object({ page: collectionPageSchema });

// Eventos do SSE em /collections/:id/events (nome do evento = `type`).
export const collectionEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('page-started'),
    pageId: z.number().int(),
    progress: collectionProgressSchema,
  }),
  z.object({
    type: z.literal('page-done'),
    page: collectionPageSchema,
    progress: collectionProgressSchema,
  }),
  z.object({
    type: z.literal('page-failed'),
    page: collectionPageSchema,
    progress: collectionProgressSchema,
  }),
  z.object({
    type: z.literal('collection-finished'),
    status: z.enum(collectionStatuses),
    progress: collectionProgressSchema,
  }),
]);
export type CollectionEvent = z.infer<typeof collectionEventSchema>;
export const collectionEventTypes = [
  'page-started',
  'page-done',
  'page-failed',
  'collection-finished',
] as const;
