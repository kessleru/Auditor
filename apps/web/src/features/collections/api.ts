import {
  type CollectionEvent,
  type CollectionStatus,
  collectionDetailResponseSchema,
  collectionEventSchema,
  collectionEventTypes,
  collectionListResponseSchema,
  collectionPageResponseSchema,
  collectionResponseSchema,
  type CreateCollectionInput,
} from '@auditoria-rf/contracts';
import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { z } from 'zod';
import { API_BASE, apiRequest } from '../../lib/api';

type CollectionDetail = z.infer<typeof collectionDetailResponseSchema>;

export const collectionKeys = {
  all: ['collections'] as const,
  list: (statuses: readonly CollectionStatus[]) =>
    ['collections', 'list', statuses.join(',')] as const,
  detail: (id: number) => ['collections', id] as const,
};

export const FINISHED_STATUSES: readonly CollectionStatus[] = ['completed', 'partial', 'cancelled'];
export const POLLING_INTERVAL_MS = 5000;
export const SSE_MAX_FAILURES = 3;

export const useCollections = (statuses: readonly CollectionStatus[]) =>
  useQuery({
    queryKey: collectionKeys.list(statuses),
    queryFn: async () =>
      (
        await apiRequest(`/collections?status=${statuses.join(',')}`, {
          schema: collectionListResponseSchema,
        })
      ).collections,
  });

export const useCollection = (id: number, { polling = false }: { polling?: boolean } = {}) =>
  useQuery({
    queryKey: collectionKeys.detail(id),
    queryFn: () => apiRequest(`/collections/${id}`, { schema: collectionDetailResponseSchema }),
    refetchInterval: (query) =>
      polling && query.state.data && !FINISHED_STATUSES.includes(query.state.data.collection.status)
        ? POLLING_INTERVAL_MS
        : false,
  });

export function useCreateCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCollectionInput) =>
      apiRequest('/collections', { method: 'POST', body: input, schema: collectionResponseSchema }),
    onSuccess: () => qc.invalidateQueries({ queryKey: collectionKeys.all }),
  });
}

export function useCancelCollection(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiRequest(`/collections/${id}/cancel`, { method: 'POST', schema: collectionResponseSchema }),
    onSuccess: () => qc.invalidateQueries({ queryKey: collectionKeys.all }),
  });
}

export function useRetryPage(collectionId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pageId: number) =>
      apiRequest(`/collection-pages/${pageId}/retry`, {
        method: 'POST',
        schema: collectionPageResponseSchema,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: collectionKeys.detail(collectionId) }),
  });
}

/** Aplica um evento do SSE ao cache da coleta, sem nova requisição. */
export function applyCollectionEvent(qc: QueryClient, id: number, event: CollectionEvent) {
  if (event.type === 'collection-finished') {
    void qc.invalidateQueries({ queryKey: collectionKeys.all });
    return;
  }
  qc.setQueryData<CollectionDetail>(collectionKeys.detail(id), (current) => {
    if (!current) return current;
    const pages =
      event.type === 'page-started'
        ? current.pages.map((p) =>
            p.id === event.pageId ? { ...p, status: 'running' as const } : p,
          )
        : current.pages.map((p) => (p.id === event.page.id ? event.page : p));
    const status = current.collection.status === 'queued' ? 'running' : current.collection.status;
    return {
      ...current,
      pages,
      collection: { ...current.collection, status, progress: event.progress },
    };
  });
}

/**
 * Progresso por SSE (`EventSource`), atualizando o cache a cada evento. O navegador reconecta
 * sozinho; ao reconectar, a coleta é recarregada para não perder eventos. Depois de 3 falhas
 * seguidas, desiste do SSE e passa a consultar a cada 5 s (seção 7, Fase 7).
 */
export function useCollectionEvents(id: number, active: boolean) {
  const qc = useQueryClient();
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    if (!active || polling || typeof EventSource === 'undefined') return;
    let failures = 0;
    let opened = false;
    const source = new EventSource(`${API_BASE}/collections/${id}/events`, {
      withCredentials: true,
    });

    const onEvent = (message: MessageEvent<string>) => {
      failures = 0;
      const parsed = collectionEventSchema.safeParse(JSON.parse(message.data));
      if (parsed.success) applyCollectionEvent(qc, id, parsed.data);
    };
    for (const type of collectionEventTypes)
      source.addEventListener(type, onEvent as EventListener);

    source.onopen = () => {
      failures = 0;
      if (opened) void qc.invalidateQueries({ queryKey: collectionKeys.detail(id) });
      opened = true;
    };
    source.onerror = () => {
      failures += 1;
      if (failures >= SSE_MAX_FAILURES) {
        source.close();
        setPolling(true);
      }
    };

    return () => source.close();
  }, [id, active, polling, qc]);

  return { polling };
}
