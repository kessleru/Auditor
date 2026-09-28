import {
  type AssistiveCheckInput,
  type AssistiveCheckKind,
  type FindingValidationInput,
  inspectionFindingsSchema,
  inspectionIncompleteSchema,
  inspectionSummarySchema,
  portalAssistiveSchema,
  portalTasksSchema,
  type TaskInspectionInput,
} from '@auditoria-rf/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { apiRequest } from '../../lib/api';

export const inspectionKeys = {
  summary: (c: number) => ['inspection', c] as const,
  findings: (c: number, i: number) => ['inspection', c, i, 'findings'] as const,
  incomplete: (c: number, i: number) => ['inspection', c, i, 'incomplete'] as const,
  tasks: (c: number, i: number) => ['inspection', c, i, 'tasks'] as const,
  assistive: (c: number, i: number) => ['inspection', c, i, 'assistive'] as const,
};

export const useInspectionSummary = (c: number) =>
  useQuery({
    queryKey: inspectionKeys.summary(c),
    queryFn: () =>
      apiRequest(`/collections/${c}/inspection-summary`, { schema: inspectionSummarySchema }),
  });

export function useSetSample(c: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (institutionIds: number[]) =>
      apiRequest(`/collections/${c}/inspection-sample`, {
        method: 'PUT',
        body: { institutionIds },
        schema: inspectionSummarySchema,
      }),
    onSuccess: (data) => qc.setQueryData(inspectionKeys.summary(c), data),
  });
}

export const useInspectionFindings = (c: number, i: number) =>
  useQuery({
    queryKey: inspectionKeys.findings(c, i),
    queryFn: () =>
      apiRequest(`/collections/${c}/institutions/${i}/findings?groupBy=page`, {
        schema: inspectionFindingsSchema,
      }),
  });

export const useInspectionIncomplete = (c: number, i: number) =>
  useQuery({
    queryKey: inspectionKeys.incomplete(c, i),
    queryFn: () =>
      apiRequest(`/collections/${c}/institutions/${i}/incomplete`, {
        schema: inspectionIncompleteSchema,
      }),
  });

export const usePortalTasks = (c: number, i: number) =>
  useQuery({
    queryKey: inspectionKeys.tasks(c, i),
    queryFn: async () =>
      (await apiRequest(`/collections/${c}/institutions/${i}/tasks`, { schema: portalTasksSchema }))
        .tasks,
  });

export const usePortalAssistive = (c: number, i: number) =>
  useQuery({
    queryKey: inspectionKeys.assistive(c, i),
    queryFn: async () =>
      (
        await apiRequest(`/collections/${c}/institutions/${i}/assistive-checks`, {
          schema: portalAssistiveSchema,
        })
      ).pages,
  });

/** Depois de registrar algo, atualiza o portal e o resumo da subamostra (contagens das abas). */
function useRefresh(c: number, i: number) {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: inspectionKeys.summary(c) }),
      qc.invalidateQueries({ queryKey: ['inspection', c, i] }),
    ]);
}

export function useValidateFinding(c: number, i: number) {
  const refresh = useRefresh(c, i);
  return useMutation({
    mutationFn: ({ findingId, ...input }: FindingValidationInput & { findingId: number }) =>
      apiRequest(`/findings/${findingId}/validation`, {
        method: 'PATCH',
        body: input,
        schema: z.unknown(),
      }),
    onSuccess: refresh,
  });
}

export function useSaveTaskInspection(c: number, i: number) {
  const refresh = useRefresh(c, i);
  return useMutation({
    mutationFn: (input: TaskInspectionInput) =>
      apiRequest('/task-inspections', { method: 'POST', body: input, schema: z.unknown() }),
    onSuccess: refresh,
  });
}

export function useSaveAssistiveCheck(c: number, i: number) {
  const refresh = useRefresh(c, i);
  return useMutation({
    mutationFn: ({
      pageId,
      kind,
      ...input
    }: AssistiveCheckInput & { pageId: number; kind: AssistiveCheckKind }) =>
      apiRequest(`/assistive-checks/${pageId}/${kind}`, {
        method: 'PUT',
        body: input,
        schema: z.unknown(),
      }),
    onSuccess: refresh,
  });
}
