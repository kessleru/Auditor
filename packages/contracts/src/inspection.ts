import { z } from 'zod';
import {
  assistiveCheckKinds,
  assistiveCheckStates,
  findingValidations,
  heuristics,
  pageFunctionKeys,
  severities,
  taskResults,
  wcagPrinciples,
} from './domain.js';

// Camada manual (seção 3.4 do plano; ADR 0008).

/** Critério de interrupção da tarefa-alvo: o que vier primeiro (decisão com o autor). */
export const TASK_LIMITS = { maxSeconds: 300, maxInteractions: 15 } as const;

export const heuristicLabels: Record<(typeof heuristics)[number], string> = {
  H1: 'H1 — visibilidade do status',
  H2: 'H2 — correspondência com o mundo real',
  H3: 'H3 — controle e liberdade',
  H4: 'H4 — consistência e padronização',
  H6: 'H6 — reconhecer em vez de lembrar',
};

export const assistiveCheckTexts: Record<
  (typeof assistiveCheckKinds)[number],
  { title: string; description: string; nature: string }
> = {
  keyboard: {
    title: 'Navegação apenas por teclado',
    description:
      'Percorrer a página com Tab e Enter, sem mouse, verificando se todo elemento interativo é alcançável e se o foco é visível.',
    nature: 'Barreira de natureza motora',
  },
  screen_reader: {
    title: 'Leitor de tela (NVDA)',
    description:
      'Ouvir a página, conferindo ordem de leitura, rótulos de formulário e qualidade dos textos alternativos.',
    nature: 'Barreira de natureza visual',
  },
  zoom_200: {
    title: 'Ampliação a 200%',
    description:
      'Ampliar o conteúdo e verificar se o texto continua legível e se a página permanece utilizável, sem rolagem horizontal.',
    nature: 'Barreira de natureza baixa visão',
  },
  captions: {
    title: 'Legendas e alternativas em texto',
    description: 'Checar se vídeos e áudios da página oferecem legenda ou transcrição.',
    nature: 'Barreira de natureza auditiva',
  },
  contrast: {
    title: 'Contraste e legibilidade',
    description: 'Conferir o contraste de textos e componentes com ferramenta de verificação.',
    nature: 'Barreira de natureza baixa visão',
  },
};

// Subamostra ------------------------------------------------------------------

export const inspectionSampleUpdateSchema = z.object({
  institutionIds: z
    .array(z.number().int().positive())
    .max(100)
    .transform((ids) => [...new Set(ids)]),
});

const progressCountsSchema = z.object({ done: z.number().int(), total: z.number().int() });

export const inspectionPortalSchema = z.object({
  institutionId: z.number().int(),
  acronym: z.string(),
  name: z.string(),
  domain: z.string(),
  pagesEvaluated: z.number().int(),
  findings: z.object({
    problems: z.number().int(),
    confirmed: z.number().int(),
    falsePositive: z.number().int(),
    pending: z.number().int(),
  }),
  tasks: progressCountsSchema,
  /** Páginas com as cinco verificações registradas. */
  assistive: progressCountsSchema,
  status: z.enum(['not_started', 'in_progress', 'done']),
});
export type InspectionPortal = z.infer<typeof inspectionPortalSchema>;

export const inspectionSummarySchema = z.object({
  collection: z.object({
    id: z.number().int(),
    finishedAt: z.string().nullable(),
    status: z.string(),
  }),
  sample: z.array(inspectionPortalSchema),
  /** Avaliados na coleta, fora da subamostra (podem ser incluídos). */
  candidates: z.array(
    z.object({ institutionId: z.number().int(), acronym: z.string(), name: z.string() }),
  ),
  /** Sem dado na coleta: não entram na inspeção. */
  withoutData: z.array(z.object({ institutionId: z.number().int(), acronym: z.string() })),
});
export type InspectionSummary = z.infer<typeof inspectionSummarySchema>;

// Validação dos achados --------------------------------------------------------

export const findingValidationSchema = z
  .object({
    validation: z.enum(['confirmed', 'false_positive']),
    note: z.string().trim().max(1000).optional(),
  })
  .refine((v) => v.validation !== 'false_positive' || (v.note?.length ?? 0) >= 10, {
    message: 'Explique por que é um falso positivo (ao menos 10 caracteres).',
    path: ['note'],
  });
export type FindingValidationInput = z.input<typeof findingValidationSchema>;

export const inspectionProblemSchema = z.object({
  /** Achado representante: a validação vale para todos com o mesmo fingerprint na coleta. */
  findingId: z.number().int(),
  fingerprint: z.string(),
  ruleId: z.string(),
  title: z.string(),
  description: z.string(),
  helpUrl: z.string(),
  wcagCriteria: z.string(),
  principle: z.enum(wcagPrinciples),
  severity: z.enum(severities),
  template: z.boolean(),
  pages: z.number().int(),
  occurrences: z.number().int(),
  validation: z.enum(findingValidations),
  validationNote: z.string().nullable(),
  example: z.object({ pageUrl: z.string(), selector: z.string(), htmlSnippet: z.string() }),
});
export type InspectionProblem = z.infer<typeof inspectionProblemSchema>;

export const inspectionFindingsSchema = z.object({
  counts: z.object({
    problems: z.number().int(),
    confirmed: z.number().int(),
    falsePositive: z.number().int(),
    pending: z.number().int(),
  }),
  groups: z.array(
    z.object({
      kind: z.enum(['template', 'page']),
      page: z
        .object({
          id: z.number().int(),
          url: z.string(),
          functionKey: z.enum(pageFunctionKeys).nullable(),
        })
        .nullable(),
      problems: z.array(inspectionProblemSchema),
    }),
  ),
});
export type InspectionFindings = z.infer<typeof inspectionFindingsSchema>;

// Tarefas-alvo ----------------------------------------------------------------

export const targetTaskSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  description: z.string(),
  functionKey: z.enum(pageFunctionKeys),
  active: z.boolean(),
});
export type TargetTask = z.infer<typeof targetTaskSchema>;

export const createTargetTaskSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(500),
  functionKey: z.enum(pageFunctionKeys),
});

export const taskInspectionInputSchema = z
  .object({
    collectionId: z.number().int().positive(),
    institutionId: z.number().int().positive(),
    taskId: z.number().int().positive(),
    result: z.enum(taskResults),
    interactions: z.number().int().min(0).max(999),
    durationSeconds: z
      .number()
      .int()
      .min(0)
      .max(24 * 3600),
    depth: z.number().int().min(0).max(50),
    path: z.array(z.string().trim().min(1).max(200)).max(50),
    heuristic: z.enum(heuristics).nullable().optional(),
    severity: z.enum(severities).nullable().optional(),
    note: z.string().trim().max(2000).default(''),
  })
  .refine((v) => v.result === 'completed' || (v.heuristic && v.severity), {
    message: 'Tarefa com dificuldade ou interrompida exige heurística violada e severidade.',
    path: ['heuristic'],
  })
  .refine((v) => v.result === 'completed' || v.note.length >= 3, {
    message: 'Descreva o que dificultou ou impediu a tarefa.',
    path: ['note'],
  });
export type TaskInspectionInput = z.input<typeof taskInspectionInputSchema>;

export const taskInspectionSchema = z.object({
  id: z.number().int(),
  taskId: z.number().int(),
  result: z.enum(taskResults),
  interactions: z.number().int(),
  durationSeconds: z.number().int(),
  depth: z.number().int(),
  path: z.array(z.string()),
  heuristic: z.enum(heuristics).nullable(),
  severity: z.enum(severities).nullable(),
  note: z.string(),
  createdAt: z.string(),
});
export type TaskInspection = z.infer<typeof taskInspectionSchema>;

export const portalTasksSchema = z.object({
  tasks: z.array(z.object({ task: targetTaskSchema, inspection: taskInspectionSchema.nullable() })),
});

// Verificação assistiva --------------------------------------------------------

export const assistiveCheckInputSchema = z
  .object({
    state: z.enum(assistiveCheckStates),
    severity: z.enum(severities).nullable().optional(),
    note: z.string().trim().max(2000).optional(),
  })
  .refine((v) => v.state !== 'barrier' || (v.severity && (v.note?.length ?? 0) >= 3), {
    message: 'Barreira exige severidade e descrição.',
    path: ['note'],
  });
export type AssistiveCheckInput = z.input<typeof assistiveCheckInputSchema>;

export const assistiveCheckSchema = z.object({
  kind: z.enum(assistiveCheckKinds),
  state: z.enum(assistiveCheckStates),
  severity: z.enum(severities).nullable(),
  note: z.string().nullable(),
});
export type AssistiveCheck = z.infer<typeof assistiveCheckSchema>;

export const portalAssistiveSchema = z.object({
  pages: z.array(
    z.object({
      id: z.number().int(),
      url: z.string(),
      functionKey: z.enum(pageFunctionKeys).nullable(),
      checks: z.array(assistiveCheckSchema),
    }),
  ),
});
