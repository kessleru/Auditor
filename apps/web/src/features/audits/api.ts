import {
  type AuditDraft,
  type AuditDraftPositionInput,
  auditDraftResponseSchema,
  collectionResponseSchema,
  type CreateInstitutionInput,
  type CreateRouteInput,
  discoveryListResponseSchema,
  discoveryResponseSchema,
  functionAbsenceResponseSchema,
  institutionListResponseSchema,
  institutionResponseSchema,
  type PageFunctionKey,
  isDiscoveryActive,
  routeListResponseSchema,
  routeResponseSchema,
  type SaveAuditDraftInput,
  type UpdateInstitutionInput,
  type UpdateRouteInput,
} from '@auditoria-rf/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { z } from 'zod';
import { apiRequest } from '../../lib/api';

export const auditKeys = {
  institutions: ['institutions'] as const,
  routes: (institutionId: number) => ['institutions', institutionId, 'routes'] as const,
  discovery: (institutionId: number) => ['institutions', institutionId, 'discovery'] as const,
  discoveries: (institutionIds: readonly number[]) =>
    ['discoveries', institutionIds.join(',')] as const,
  draft: ['audit-draft'] as const,
};

/** Consulta de novo a cada 3 s enquanto alguma descoberta está na fila ou em execução. */
const DISCOVERY_POLL_MS = 3000;

// Auditoria em montagem (ADR 0017) ---------------------------------------------------------------

/** Rascunho do auditor da sessão; `null` sem auditoria em montagem. */
export const useAuditDraft = () =>
  useQuery({
    queryKey: auditKeys.draft,
    queryFn: async () =>
      (await apiRequest('/audit-draft', { schema: auditDraftResponseSchema })).draft,
  });

export function useSaveAuditDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveAuditDraftInput) =>
      apiRequest('/audit-draft', {
        method: 'PUT',
        body: input,
        schema: auditDraftResponseSchema,
      }),
    onSuccess: ({ draft }) => {
      qc.setQueryData(auditKeys.draft, draft);
      // Confirmar o escopo pode ter posto descobertas na fila.
      void qc.invalidateQueries({ queryKey: ['discoveries'] });
    },
  });
}

/**
 * Guarda onde o auditor está no fluxo (etapa e instituição), para "Nova auditoria" voltar ao
 * mesmo ponto. Só grava quando a posição muda.
 */
export function useRememberDraftPosition(
  draft: AuditDraft | null | undefined,
  position: AuditDraftPositionInput,
) {
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: (input: AuditDraftPositionInput) =>
      apiRequest('/audit-draft/position', {
        method: 'PATCH',
        body: input,
        schema: auditDraftResponseSchema,
      }),
    onSuccess: ({ draft: saved }) => qc.setQueryData(auditKeys.draft, saved),
  });
  const { mutate, isPending } = save;
  const { step, institutionId } = position;
  const differs =
    draft !== null &&
    draft !== undefined &&
    (draft.step !== step || draft.institutionId !== institutionId);
  useEffect(() => {
    if (differs && !isPending) mutate({ step, institutionId });
  }, [differs, isPending, mutate, step, institutionId]);
}

/**
 * Descarta a auditoria em montagem. `onDiscarded` roda mesmo que o botão já tenha saído da tela
 * (o callback de `mutate` não rodaria).
 */
export function useDiscardAuditDraft({ onDiscarded }: { onDiscarded?: () => void } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiRequest('/audit-draft', { method: 'DELETE' }),
    onSuccess: () => {
      onDiscarded?.();
      qc.setQueryData(auditKeys.draft, null);
    },
  });
}

/** Cria a coleta com o escopo salvo; o rascunho sai quando a coleta foi criada. */
export function useStartAuditDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiRequest('/audit-draft/start', { method: 'POST', schema: collectionResponseSchema }),
    onSuccess: () => {
      qc.setQueryData(auditKeys.draft, null);
      void qc.invalidateQueries({ queryKey: ['collections'] });
    },
  });
}

/**
 * Situação da descoberta de várias instituições (fila, andamento, resultado). Quando uma termina,
 * as rotas dela são recarregadas.
 */
export function useDiscoveries(institutionIds: readonly number[]) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: auditKeys.discoveries(institutionIds),
    enabled: institutionIds.length > 0,
    queryFn: async () =>
      (
        await apiRequest(`/discoveries?institutionIds=${institutionIds.join(',')}`, {
          schema: discoveryListResponseSchema,
        })
      ).discoveries,
    refetchInterval: (query) =>
      query.state.data?.some((d) => isDiscoveryActive(d.status)) ? DISCOVERY_POLL_MS : false,
  });
  const activeIds = (query.data ?? [])
    .filter((d) => isDiscoveryActive(d.status))
    .map((d) => d.institutionId)
    .join(',');
  const previous = useRef(activeIds);
  useEffect(() => {
    const now = new Set(activeIds.split(','));
    for (const id of previous.current.split(',').filter(Boolean)) {
      if (now.has(id)) continue;
      void qc.invalidateQueries({ queryKey: auditKeys.routes(Number(id)) });
      void qc.invalidateQueries({ queryKey: auditKeys.discovery(Number(id)) });
    }
    previous.current = activeIds;
  }, [activeIds, qc]);
  return query;
}

/** Põe várias instituições na fila da descoberta de uma vez. */
export function useStartDiscoveries(institutionIds: readonly number[]) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: number[]) =>
      apiRequest('/discoveries', {
        method: 'POST',
        body: { institutionIds: ids },
        schema: discoveryListResponseSchema,
      }),
    onSuccess: ({ discoveries }) => {
      qc.setQueryData(auditKeys.discoveries(institutionIds), discoveries);
      for (const d of discoveries) qc.setQueryData(auditKeys.discovery(d.institutionId), d);
    },
  });
}

export const useInstitutions = () =>
  useQuery({
    queryKey: auditKeys.institutions,
    queryFn: async () =>
      (await apiRequest('/institutions', { schema: institutionListResponseSchema })).institutions,
  });

export function useCreateInstitution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateInstitutionInput) =>
      apiRequest('/institutions', {
        method: 'POST',
        body: input,
        schema: institutionResponseSchema,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: auditKeys.institutions }),
  });
}

export function useUpdateInstitution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateInstitutionInput & { id: number }) =>
      apiRequest(`/institutions/${id}`, {
        method: 'PATCH',
        body: input,
        schema: institutionResponseSchema,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: auditKeys.institutions }),
  });
}

/** Rotas descobertas e funções marcadas como não encontradas de uma instituição. */
export const fetchRoutes = (institutionId: number) =>
  apiRequest(`/institutions/${institutionId}/routes`, { schema: routeListResponseSchema });

export const useRoutes = (institutionId: number) =>
  useQuery({
    queryKey: auditKeys.routes(institutionId),
    queryFn: () => fetchRoutes(institutionId),
  });

/**
 * Andamento da descoberta; consulta a cada 3 s enquanto está na fila ou em execução. As rotas só
 * são gravadas no fim: quando ela termina, a lista de rotas é recarregada.
 */
export function useDiscovery(institutionId: number) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: auditKeys.discovery(institutionId),
    queryFn: async () =>
      (
        await apiRequest(`/institutions/${institutionId}/discovery`, {
          schema: discoveryResponseSchema,
        })
      ).discovery,
    refetchInterval: (query) =>
      query.state.data && isDiscoveryActive(query.state.data.status) ? DISCOVERY_POLL_MS : false,
  });
  const active = query.data ? isDiscoveryActive(query.data.status) : false;
  const previous = useRef(active);
  useEffect(() => {
    if (previous.current && !active) {
      void qc.invalidateQueries({ queryKey: auditKeys.routes(institutionId) });
    }
    previous.current = active;
  }, [active, qc, institutionId]);
  return query;
}

export function useStartDiscovery(institutionId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiRequest(`/institutions/${institutionId}/discover`, {
        method: 'POST',
        schema: discoveryResponseSchema,
      }),
    onSuccess: ({ discovery }) => {
      qc.setQueryData(auditKeys.discovery(institutionId), discovery);
      void qc.invalidateQueries({ queryKey: ['discoveries'] });
    },
  });
}

/** Invalida rotas e descoberta de uma instituição depois de uma decisão do auditor. */
function useRefreshInstitution(institutionId: number) {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: auditKeys.routes(institutionId) }),
      qc.invalidateQueries({ queryKey: auditKeys.discovery(institutionId) }),
    ]);
}

export function useUpdateRoute(institutionId: number) {
  const refresh = useRefreshInstitution(institutionId);
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateRouteInput & { id: number }) =>
      apiRequest(`/routes/${id}`, { method: 'PATCH', body: input, schema: routeResponseSchema }),
    onSuccess: refresh,
  });
}

export function useCreateRoute(institutionId: number) {
  const refresh = useRefreshInstitution(institutionId);
  return useMutation({
    mutationFn: (input: CreateRouteInput) =>
      apiRequest(`/institutions/${institutionId}/routes`, {
        method: 'POST',
        body: input,
        schema: routeResponseSchema,
      }),
    onSuccess: refresh,
  });
}

export function useReplaceRoute(institutionId: number) {
  const refresh = useRefreshInstitution(institutionId);
  return useMutation({
    mutationFn: ({ routeId, newRouteId }: { routeId: number; newRouteId: number }) =>
      apiRequest(`/routes/${routeId}/replace`, {
        method: 'POST',
        body: { newRouteId },
        schema: z.object({ route: z.unknown(), replaced: z.unknown() }),
      }),
    onSuccess: refresh,
  });
}

/** O auditor procurou e a instituição não tem a página da função (ADR 0013). */
export function useMarkAbsent(institutionId: number) {
  const refresh = useRefreshInstitution(institutionId);
  return useMutation({
    mutationFn: ({ functionKey, reason }: { functionKey: PageFunctionKey; reason: string }) =>
      apiRequest(`/institutions/${institutionId}/functions/${functionKey}/absence`, {
        method: 'PUT',
        body: { reason },
        schema: functionAbsenceResponseSchema,
      }),
    onSuccess: refresh,
  });
}

export function useClearAbsence(institutionId: number) {
  const refresh = useRefreshInstitution(institutionId);
  return useMutation({
    mutationFn: (functionKey: PageFunctionKey) =>
      apiRequest(`/institutions/${institutionId}/functions/${functionKey}/absence`, {
        method: 'DELETE',
      }),
    onSuccess: refresh,
  });
}
