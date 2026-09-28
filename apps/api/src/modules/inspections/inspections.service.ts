import {
  type AssistiveCheck,
  type assistiveCheckInputSchema,
  assistiveCheckKinds,
  type AssistiveCheckKind,
  type CollectionScope,
  type createTargetTaskSchema,
  type findingValidationSchema,
  type InspectionFindings,
  type InspectionPortal,
  type InspectionProblem,
  type InspectionSummary,
  type TargetTask,
  TEMPLATE_MIN_PAGES,
  TEMPLATE_THRESHOLD,
  type TaskInspection,
  type taskInspectionInputSchema,
} from '@auditoria-rf/contracts';
import type { z } from 'zod';
import { ruleTexts } from '../../infra/auditor/rule-texts.js';
import { AppError, NotFoundError } from '../../shared/errors.js';
import type { InspectionsRepository } from './inspections.repository.js';
import { findingExample } from '../findings/finding-example.js';

type ValidationInput = z.output<typeof findingValidationSchema>;
type TaskInput = z.output<typeof taskInspectionInputSchema>;
type AssistiveInput = z.output<typeof assistiveCheckInputSchema>;
type NewTask = z.output<typeof createTargetTaskSchema>;

const FINISHED = ['completed', 'partial'];

/**
 * Camada manual (seção 3.4; ADR 0008): subamostra escolhida pelo auditor, validação por problema
 * distinto (fingerprint), tarefas-alvo e verificação assistiva, sempre um portal por vez.
 */
export function createInspectionsService(
  repo: InspectionsRepository,
  { now = () => new Date() } = {},
) {
  const finishedCollection = (id: number) => {
    const collection = repo.collection(id);
    if (!collection) throw new NotFoundError('Coleta não encontrada.');
    if (!FINISHED.includes(collection.status)) {
      throw new AppError(
        409,
        'COLLECTION_NOT_FINISHED',
        'A inspeção manual começa depois que a coleta termina.',
      );
    }
    return { ...collection, scope: collection.scopeJson as CollectionScope };
  };

  const evaluatedInstitutions = (collectionId: number) => {
    const pages = repo.pagesOf(collectionId);
    return new Set(pages.filter((p) => p.status === 'done').map((p) => p.institutionId));
  };

  const requireInSample = (collectionId: number, institutionId: number) => {
    if (!repo.sampleIds(collectionId).includes(institutionId)) {
      throw new AppError(
        409,
        'NOT_IN_SAMPLE',
        'O portal não está na subamostra da inspeção manual desta coleta.',
      );
    }
  };

  /** Problemas distintos do portal na coleta, com validação e marcação de template. */
  const problemsOf = (collectionId: number, institutionId: number) => {
    const pages = repo.pagesOf(collectionId, institutionId).filter((p) => p.status === 'done');
    const evaluatedIds = new Set(pages.map((p) => p.id));
    const rows = repo
      .findingsOf(collectionId, institutionId)
      .filter((f) => evaluatedIds.has(f.collectionPageId));
    const byFingerprint = new Map<string, typeof rows>();
    for (const row of rows)
      byFingerprint.set(row.fingerprint, [...(byFingerprint.get(row.fingerprint) ?? []), row]);

    const problems = [...byFingerprint.values()].map((group) => {
      const first = group[0] as (typeof rows)[number];
      const pageIds = new Set(group.map((f) => f.collectionPageId));
      const template =
        pages.length >= TEMPLATE_MIN_PAGES && pageIds.size / pages.length >= TEMPLATE_THRESHOLD;
      const problem: InspectionProblem = {
        findingId: first.id,
        fingerprint: first.fingerprint,
        ruleId: first.ruleId,
        ...ruleTexts(first.ruleId, first.help),
        helpUrl: first.helpUrl,
        wcagCriteria: first.wcagCriteria,
        principle: first.principle,
        severity: first.severity,
        template,
        pages: pageIds.size,
        occurrences: group.length,
        validation: first.validation,
        validationNote: first.validationNote,
        example: findingExample(first),
      };
      return { problem, firstPageId: first.collectionPageId };
    });
    return { pages, problems };
  };

  const countValidations = (problems: InspectionProblem[]) => ({
    problems: problems.length,
    confirmed: problems.filter((p) => p.validation === 'confirmed').length,
    falsePositive: problems.filter((p) => p.validation === 'false_positive').length,
    pending: problems.filter((p) => p.validation === 'pending').length,
  });

  const tasksFor = (scope: CollectionScope) => repo.activeTasks(scope.functions);

  const portalOf = (
    collectionId: number,
    scope: CollectionScope,
    institution: { id: number; acronym: string; name: string; domain: string },
  ): InspectionPortal => {
    const { pages, problems } = problemsOf(collectionId, institution.id);
    const findings = countValidations(problems.map((p) => p.problem));
    const tasks = tasksFor(scope);
    const inspections = repo.taskInspectionsOf(collectionId, institution.id);
    const tasksDone = tasks.filter((t) => inspections.some((i) => i.taskId === t.id)).length;
    const checks = repo.assistiveChecksOf(pages.map((p) => p.id));
    const pagesDone = pages.filter((page) =>
      assistiveCheckKinds.every((kind) =>
        checks.some(
          (c) => c.collectionPageId === page.id && c.kind === kind && c.state !== 'pending',
        ),
      ),
    ).length;

    const started = findings.pending < findings.problems || tasksDone > 0 || checks.length > 0;
    const done = findings.pending === 0 && tasksDone === tasks.length && pagesDone === pages.length;
    return {
      institutionId: institution.id,
      acronym: institution.acronym,
      name: institution.name,
      domain: institution.domain,
      pagesEvaluated: pages.length,
      findings,
      tasks: { done: tasksDone, total: tasks.length },
      assistive: { done: pagesDone, total: pages.length },
      status: done ? 'done' : started ? 'in_progress' : 'not_started',
    };
  };

  const toTask = (t: ReturnType<InspectionsRepository['allTasks']>[number]): TargetTask => ({
    id: t.id,
    title: t.title,
    description: t.description,
    functionKey: t.functionKey,
    active: t.active,
  });

  return {
    /** Situação do portal na camada manual de uma coleta; `null` se não está na subamostra. */
    portalStatus(collectionId: number, institutionId: number): InspectionPortal | null {
      const collection = repo.collection(collectionId);
      if (!collection || !FINISHED.includes(collection.status)) return null;
      if (!repo.sampleIds(collectionId).includes(institutionId)) return null;
      const [institution] = repo.institutionsByIds([institutionId]);
      if (!institution) return null;
      return portalOf(collectionId, collection.scopeJson as CollectionScope, institution);
    },

    /** Achados da camada manual: tarefas com dificuldade ou interrompidas e barreiras assistivas. */
    manualFindings(collectionId: number, institutionId: number) {
      const tasks = repo.allTasks();
      const taskFindings = repo
        .taskInspectionsOf(collectionId, institutionId)
        .filter((i) => i.result !== 'completed')
        .map((i) => {
          const task = tasks.find((t) => t.id === i.taskId);
          const inspection = toInspection(i);
          return {
            taskTitle: task?.title ?? '',
            taskDescription: task?.description ?? '',
            result: inspection.result,
            heuristic: inspection.heuristic,
            severity: inspection.severity,
            interactions: inspection.interactions,
            durationSeconds: inspection.durationSeconds,
            path: inspection.path,
            note: inspection.note,
          };
        });
      const pages = repo.pagesOf(collectionId, institutionId);
      const barriers = repo
        .assistiveChecksOf(pages.map((p) => p.id))
        .filter((c) => c.state === 'barrier')
        .map((c) => ({
          pageUrl: pages.find((p) => p.id === c.collectionPageId)?.url ?? '',
          kind: c.kind,
          severity: c.severity,
          note: c.note,
        }));
      return { tasks: taskFindings, barriers };
    },

    summary(collectionId: number): InspectionSummary {
      const collection = finishedCollection(collectionId);
      const evaluated = evaluatedInstitutions(collectionId);
      const inScope = repo.institutionsByIds(collection.scope.institutionIds);
      const sampleIds = repo.sampleIds(collectionId);
      return {
        collection: {
          id: collection.id,
          finishedAt: collection.finishedAt?.toISOString() ?? null,
          status: collection.status,
        },
        sample: inScope
          .filter((i) => sampleIds.includes(i.id) && evaluated.has(i.id))
          .map((i) => portalOf(collectionId, collection.scope, i)),
        candidates: inScope
          .filter((i) => evaluated.has(i.id) && !sampleIds.includes(i.id))
          .map((i) => ({ institutionId: i.id, acronym: i.acronym, name: i.name })),
        withoutData: inScope
          .filter((i) => !evaluated.has(i.id))
          .map((i) => ({ institutionId: i.id, acronym: i.acronym })),
      };
    },

    /** Define a subamostra: só portais avaliados nesta coleta. */
    setSample(collectionId: number, institutionIds: number[], selectedBy: number) {
      const collection = finishedCollection(collectionId);
      const evaluated = evaluatedInstitutions(collectionId);
      const invalid = institutionIds.filter(
        (id) => !collection.scope.institutionIds.includes(id) || !evaluated.has(id),
      );
      if (invalid.length > 0) {
        throw new AppError(
          422,
          'NOT_EVALUATED',
          'Só portais avaliados nesta coleta entram na subamostra.',
          {
            institutionIds: invalid,
          },
        );
      }
      repo.setSample(collectionId, institutionIds, selectedBy);
    },

    findings(collectionId: number, institutionId: number): InspectionFindings {
      finishedCollection(collectionId);
      requireInSample(collectionId, institutionId);
      const { pages, problems } = problemsOf(collectionId, institutionId);
      const template = problems.filter((p) => p.problem.template).map((p) => p.problem);
      const groups: InspectionFindings['groups'] = [];
      if (template.length > 0) groups.push({ kind: 'template', page: null, problems: template });
      for (const page of pages) {
        const own = problems
          .filter((p) => !p.problem.template && p.firstPageId === page.id)
          .map((p) => p.problem);
        if (own.length > 0) {
          groups.push({
            kind: 'page',
            page: { id: page.id, url: page.url, functionKey: page.functionKey },
            problems: own,
          });
        }
      }
      return { counts: countValidations(problems.map((p) => p.problem)), groups };
    },

    /** Confirma ou descarta um problema (todos os achados com o mesmo fingerprint na coleta). */
    validate(findingId: number, input: ValidationInput, userId: number) {
      const finding = repo.findingWithCollection(findingId);
      if (!finding) throw new NotFoundError('Achado não encontrado.');
      finishedCollection(finding.collectionId);
      requireInSample(finding.collectionId, finding.institutionId);
      // Falso positivo nunca é apagado: fica registrado com a justificativa.
      if (finding.validation === 'false_positive') {
        throw new AppError(
          409,
          'FALSE_POSITIVE_FINAL',
          'Falso positivo já registrado não pode ser alterado.',
        );
      }
      repo.validateProblem(finding.collectionId, finding.fingerprint, {
        validation: input.validation,
        validationNote: input.note && input.note.length > 0 ? input.note : null,
        validatedBy: userId,
        validatedAt: now(),
      });
      return repo.findingWithCollection(findingId);
    },

    listTasks: () => repo.allTasks().map(toTask),

    createTask(input: NewTask): TargetTask {
      const functionId = repo.functionId(input.functionKey);
      if (functionId === undefined)
        throw new AppError(422, 'UNKNOWN_FUNCTION', 'Função desconhecida.');
      const created = repo.insertTask({
        title: input.title,
        description: input.description,
        functionId,
      });
      return { ...toTask({ ...created, functionKey: input.functionKey }) };
    },

    tasks(collectionId: number, institutionId: number) {
      const collection = finishedCollection(collectionId);
      requireInSample(collectionId, institutionId);
      const inspections = repo.taskInspectionsOf(collectionId, institutionId);
      return tasksFor(collection.scope).map((task) => {
        const inspection = inspections.find((i) => i.taskId === task.id);
        return {
          task: toTask(task),
          inspection: inspection ? toInspection(inspection) : null,
        };
      });
    },

    saveTaskInspection(input: TaskInput, inspectorId: number): TaskInspection {
      const collection = finishedCollection(input.collectionId);
      requireInSample(input.collectionId, input.institutionId);
      if (!tasksFor(collection.scope).some((t) => t.id === input.taskId)) {
        throw new AppError(
          422,
          'TASK_NOT_IN_SCOPE',
          'A tarefa não pertence às funções desta coleta.',
        );
      }
      const completed = input.result === 'completed';
      const saved = repo.upsertTaskInspection({
        collectionId: input.collectionId,
        institutionId: input.institutionId,
        taskId: input.taskId,
        result: input.result,
        interactions: input.interactions,
        durationSeconds: input.durationSeconds,
        depth: input.depth,
        pathJson: input.path,
        heuristic: completed ? null : (input.heuristic ?? null),
        severity: completed ? null : (input.severity ?? null),
        note: input.note,
        inspectorId,
        createdAt: now(),
      });
      return toInspection(saved);
    },

    assistive(collectionId: number, institutionId: number) {
      finishedCollection(collectionId);
      requireInSample(collectionId, institutionId);
      const pages = repo.pagesOf(collectionId, institutionId).filter((p) => p.status === 'done');
      const checks = repo.assistiveChecksOf(pages.map((p) => p.id));
      return pages.map((page) => ({
        id: page.id,
        url: page.url,
        functionKey: page.functionKey,
        checks: assistiveCheckKinds.map((kind): AssistiveCheck => {
          const check = checks.find((c) => c.collectionPageId === page.id && c.kind === kind);
          return {
            kind,
            state: check?.state ?? 'pending',
            severity: check?.severity ?? null,
            note: check?.note ?? null,
          };
        }),
      }));
    },

    saveAssistiveCheck(
      pageId: number,
      kind: AssistiveCheckKind,
      input: AssistiveInput,
      inspectorId: number,
    ): AssistiveCheck {
      const page = repo.pageWithCollection(pageId);
      if (!page || page.status !== 'done')
        throw new NotFoundError('Página avaliada não encontrada.');
      finishedCollection(page.collectionId);
      requireInSample(page.collectionId, page.institutionId);
      const barrier = input.state === 'barrier';
      const saved = repo.upsertAssistiveCheck({
        collectionPageId: pageId,
        kind,
        state: input.state,
        severity: barrier ? (input.severity ?? null) : null,
        note: input.note && input.note.length > 0 ? input.note : null,
        inspectorId,
      });
      return { kind: saved.kind, state: saved.state, severity: saved.severity, note: saved.note };
    },
  };
}

function toInspection(row: {
  id: number;
  taskId: number;
  result: TaskInspection['result'];
  interactions: number;
  durationSeconds: number;
  depth: number;
  pathJson: unknown;
  heuristic: TaskInspection['heuristic'];
  severity: TaskInspection['severity'];
  note: string;
  createdAt: Date;
}): TaskInspection {
  return {
    id: row.id,
    taskId: row.taskId,
    result: row.result,
    interactions: row.interactions,
    durationSeconds: row.durationSeconds,
    depth: row.depth,
    path: Array.isArray(row.pathJson) ? (row.pathJson as string[]) : [],
    heuristic: row.heuristic,
    severity: row.severity,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
  };
}

export type InspectionsService = ReturnType<typeof createInspectionsService>;
