import {
  type CreateInstitutionInput,
  type CreateRouteInput,
  discoveryResponseSchema,
  institutionListResponseSchema,
  institutionResponseSchema,
  routeListResponseSchema,
  routeResponseSchema,
  type UpdateInstitutionInput,
  type UpdateRouteInput,
} from '@auditoria-rf/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { apiRequest } from '../../lib/api';

export const auditKeys = {
  institutions: ['institutions'] as const,
  routes: (institutionId: number) => ['institutions', institutionId, 'routes'] as const,
  discovery: (institutionId: number) => ['institutions', institutionId, 'discovery'] as const,
};

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

export const useRoutes = (institutionId: number) =>
  useQuery({
    queryKey: auditKeys.routes(institutionId),
    queryFn: async () =>
      (
        await apiRequest(`/institutions/${institutionId}/routes`, {
          schema: routeListResponseSchema,
        })
      ).routes,
  });

/** Andamento da descoberta; consulta a cada 3 s enquanto está em execução. */
export const useDiscovery = (institutionId: number) =>
  useQuery({
    queryKey: auditKeys.discovery(institutionId),
    queryFn: async () =>
      (
        await apiRequest(`/institutions/${institutionId}/discovery`, {
          schema: discoveryResponseSchema,
        })
      ).discovery,
    refetchInterval: (query) => (query.state.data?.status === 'running' ? 3000 : false),
  });

export function useStartDiscovery(institutionId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiRequest(`/institutions/${institutionId}/discover`, {
        method: 'POST',
        schema: discoveryResponseSchema,
      }),
    onSuccess: ({ discovery }) => qc.setQueryData(auditKeys.discovery(institutionId), discovery),
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
