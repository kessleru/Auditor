import { z } from 'zod';
import { pageFunctionKeys, routeSources, routeStatuses } from './domain.js';

export const routeSchema = z.object({
  id: z.number().int(),
  institutionId: z.number().int(),
  url: z.string(),
  normalizedUrl: z.string(),
  /** Função atribuída: sugestão enquanto `status = 'suggested'`; decisão do auditor depois. */
  functionKey: z.enum(pageFunctionKeys).nullable(),
  source: z.enum(routeSources),
  status: z.enum(routeStatuses),
  exclusionReason: z.string().nullable(),
  replacedByRouteId: z.number().int().nullable(),
  discoveredAt: z.string(),
  confirmedAt: z.string().nullable(),
  lastSeenAt: z.string().nullable(),
});
export type Route = z.infer<typeof routeSchema>;

export const routeListQuerySchema = z.object({ status: z.enum(routeStatuses).optional() });

// PATCH /routes/:id — confirmar, excluir (com motivo) ou atribuir função.
export const updateRouteSchema = z
  .object({
    status: z.enum(['suggested', 'confirmed', 'excluded']).optional(),
    functionKey: z.enum(pageFunctionKeys).nullable().optional(),
    exclusionReason: z.string().trim().min(3, 'Explique o motivo da exclusão.').max(500).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Informe ao menos um campo para alterar.')
  .refine((v) => v.status !== 'excluded' || v.exclusionReason !== undefined, {
    message: 'Excluir uma rota exige o motivo.',
    path: ['exclusionReason'],
  })
  .refine((v) => v.exclusionReason === undefined || v.status === 'excluded', {
    message: 'O motivo só se aplica ao excluir a rota.',
    path: ['exclusionReason'],
  });
export type UpdateRouteInput = z.input<typeof updateRouteSchema>;

export const routeResponseSchema = z.object({ route: routeSchema });
export const routeListResponseSchema = z.object({ routes: z.array(routeSchema) });

export const discoveryStatuses = ['idle', 'running', 'completed', 'failed'] as const;

export const discoverySummarySchema = z.object({
  source: z.enum(['sitemap', 'crawler']),
  origin: z.string(),
  robotsTxtFound: z.boolean(),
  sitemapFiles: z.number().int(),
  /** Rotas encontradas nesta descoberta (inclui já conhecidas). */
  found: z.number().int(),
  /** Rotas que ainda não existiam. */
  created: z.number().int(),
  authenticated: z.number().int(),
  excluded: z.number().int(),
  blockedByRobots: z.number().int(),
  failed: z.number().int(),
});
export type DiscoverySummary = z.infer<typeof discoverySummarySchema>;

export const discoveryStateSchema = z.object({
  institutionId: z.number().int(),
  status: z.enum(discoveryStatuses),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  error: z.string().nullable(),
  summary: discoverySummarySchema.nullable(),
});
export type DiscoveryState = z.infer<typeof discoveryStateSchema>;

export const discoveryResponseSchema = z.object({ discovery: discoveryStateSchema });
