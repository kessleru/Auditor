import { type AuthUser, authUserResponseSchema } from '@auditoria-rf/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, apiRequest } from '../../lib/api';

export const auditorQueryKey = ['auth', 'me'] as const;

/** Auditor da sessão atual; `null` quando não há sessão (401). */
export function useAuditor() {
  return useQuery({
    queryKey: auditorQueryKey,
    queryFn: async (): Promise<AuthUser | null> => {
      try {
        return (await apiRequest('/auth/me', { schema: authUserResponseSchema })).user;
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    staleTime: 5 * 60_000,
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiRequest('/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      queryClient.setQueryData(auditorQueryKey, null);
    },
  });
}
