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
  /** Título da página na última descoberta (ausente em rota manual ou não acessada). */
  title: z.string().nullable(),
  /** Texto do link que levou à página. */
  linkText: z.string().nullable(),
  /** Relevância da sugestão automática (0–100): ordena as candidatas; nunca decide sozinha. */
  relevance: z.number().int().nullable(),
});
export type Route = z.infer<typeof routeSchema>;

export const routeListQuerySchema = z.object({ status: z.enum(routeStatuses).optional() });

// PATCH /routes/:id — confirmar, excluir (com motivo) ou atribuir função.
export const updateRouteSchema = z
  .object({
    status: z.enum(['suggested', 'confirmed', 'excluded']).optional(),
    functionKey: z.enum(pageFunctionKeys).nullable().optional(),
    exclusionReason: z.string().trim().min(3, 'Explique o motivo da exclusão.').max(500).optional(),
    /**
     * Ao confirmar com uma função que já tem rota confirmada na instituição, a anterior volta a ser
     * sugestão (troca atômica). Sem isto, a API recusa: uma rota confirmada por função.
     */
    replaceConfirmed: z.boolean().optional(),
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

/** Rota informada pelo auditor (origem `manual`); já entra confirmada. */
export const createRouteSchema = z.object({
  url: z.url('Informe uma URL completa, com https://.'),
  functionKey: z.enum(pageFunctionKeys),
  replaceConfirmed: z.boolean().optional(),
});
export type CreateRouteInput = z.input<typeof createRouteSchema>;

/** Confirma a substituição de uma rota que mudou de endereço (seção 3.1.7). */
export const replaceRouteSchema = z.object({ newRouteId: z.number().int().positive() });

/** Função procurada e não encontrada no portal (ADR 0013): entra na cobertura da instituição. */
export const functionAbsenceSchema = z.object({
  institutionId: z.number().int(),
  functionKey: z.enum(pageFunctionKeys),
  reason: z.string(),
  decidedAt: z.string(),
});
export type FunctionAbsence = z.infer<typeof functionAbsenceSchema>;

// PUT /institutions/:id/functions/:functionKey/absence
export const markFunctionAbsentSchema = z.object({
  reason: z.string().trim().min(10, 'Diga onde procurou (ao menos 10 caracteres).').max(500),
});
export type MarkFunctionAbsentInput = z.input<typeof markFunctionAbsentSchema>;

export const routeResponseSchema = z.object({ route: routeSchema });
export const routeListResponseSchema = z.object({
  routes: z.array(routeSchema),
  /** Funções marcadas como não encontradas na instituição. */
  absences: z.array(functionAbsenceSchema),
});
export const functionAbsenceResponseSchema = z.object({ absence: functionAbsenceSchema });

/**
 * Situação de uma descoberta na fila (ADR 0017): `queued` espera vaga, `running` está lendo o
 * portal. A fila fica no banco e é retomada quando a API reinicia.
 */
export const discoveryRunStatuses = ['queued', 'running', 'completed', 'failed'] as const;
export type DiscoveryRunStatus = (typeof discoveryRunStatuses)[number];

/** `idle` = a instituição nunca teve descoberta. */
export const discoveryStatuses = ['idle', ...discoveryRunStatuses] as const;
export type DiscoveryStatus = (typeof discoveryStatuses)[number];

/** A descoberta ainda não terminou (na fila ou lendo o portal). */
export const isDiscoveryActive = (status: DiscoveryStatus) =>
  status === 'queued' || status === 'running';

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
  /** Rotas públicas com função sugerida (candidatas para a revisão). */
  withSuggestion: z.number().int(),
  blockedByRobots: z.number().int(),
  failed: z.number().int(),
  /** Parou antes de percorrer tudo: tempo máximo ou falhas seguidas (portal parou de responder). */
  stoppedEarly: z.enum(['deadline', 'failures']).nullable(),
  /** Domínio fora da instituição para onde páginas foram mandadas (proteção contra robôs). */
  offDomainHost: z.string().nullable(),
});
export type DiscoverySummary = z.infer<typeof discoverySummarySchema>;

/** Rota confirmada que não responde mais ou mudou de endereço, com a candidata a substituí-la. */
export const routeReplacementSchema = z.object({
  routeId: z.number().int(),
  url: z.string(),
  functionKey: z.enum(pageFunctionKeys).nullable(),
  reason: z.enum(['not_found', 'moved']),
  httpStatus: z.number().int().nullable(),
  candidateRouteId: z.number().int().nullable(),
  candidateUrl: z.string().nullable(),
});
export type RouteReplacement = z.infer<typeof routeReplacementSchema>;

/** Etapas da descoberta, na ordem: robots.txt e página inicial, sitemap, páginas, rotas confirmadas. */
export const discoveryPhases = ['robots', 'sitemap', 'pages', 'checks'] as const;

export const discoveryProgressSchema = z.object({
  phase: z.enum(discoveryPhases),
  /** Páginas lidas até agora (inclui a inicial). */
  visited: z.number().int(),
  /** Teto de páginas desta rodada; `null` enquanto não se sabe (antes do sitemap). */
  planned: z.number().int().nullable(),
});
export type DiscoveryProgress = z.infer<typeof discoveryProgressSchema>;

export const discoveryStateSchema = z.object({
  institutionId: z.number().int(),
  status: z.enum(discoveryStatuses),
  /** Andamento enquanto `status = 'running'`; `null` fora disso. */
  progress: discoveryProgressSchema.nullable(),
  /** Quando entrou na fila; `null` sem descoberta. */
  queuedAt: z.string().nullable(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  error: z.string().nullable(),
  summary: discoverySummarySchema.nullable(),
  /** Possíveis substituições encontradas na última descoberta; nunca aplicadas sozinhas. */
  replacements: z.array(routeReplacementSchema),
});
export type DiscoveryState = z.infer<typeof discoveryStateSchema>;

export const discoveryResponseSchema = z.object({ discovery: discoveryStateSchema });
export const discoveryListResponseSchema = z.object({
  discoveries: z.array(discoveryStateSchema),
});

const institutionIdList = z
  .array(z.number().int().positive())
  .max(100)
  .transform((ids) => [...new Set(ids)]);

/** Descoberta em lote (várias instituições entram na fila de uma vez). */
export const startDiscoveriesSchema = z.object({
  institutionIds: institutionIdList.refine(
    (ids) => ids.length > 0,
    'Escolha ao menos uma instituição.',
  ),
});
export type StartDiscoveriesInput = z.input<typeof startDiscoveriesSchema>;

/** `?institutionIds=1,2,3`: situação da descoberta de cada uma. */
export const discoveryListQuerySchema = z.object({
  institutionIds: z
    .string()
    .transform((value) =>
      value
        .split(',')
        .filter((part) => part.trim() !== '')
        .map(Number),
    )
    .pipe(institutionIdList),
});
