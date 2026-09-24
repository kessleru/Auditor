import {
  methodologySchema,
  publicFindingsResponseSchema,
  publicInstitutionDetailSchema,
  publicInstitutionListResponseSchema,
  publicSummarySchema,
} from '@auditoria-rf/contracts';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../lib/api';

export const publicKeys = {
  summary: ['public', 'summary'] as const,
  institutions: ['public', 'institutions'] as const,
  institution: (id: number) => ['public', 'institutions', id] as const,
  findings: (id: number) => ['public', 'institutions', id, 'findings'] as const,
  methodology: ['public', 'methodology'] as const,
};

export const usePublicSummary = () =>
  useQuery({
    queryKey: publicKeys.summary,
    queryFn: () => apiRequest('/public/summary', { schema: publicSummarySchema }),
  });

const fetchInstitutions = () =>
  apiRequest('/public/institutions', { schema: publicInstitutionListResponseSchema });

export const usePublicInstitutions = () =>
  useQuery({
    queryKey: publicKeys.institutions,
    queryFn: fetchInstitutions,
    select: (data) => data.institutions,
  });

/** Funções avaliadas em todas as instituições: a base da comparação (ADR 0013). */
export const usePublicCoreFunctions = () =>
  useQuery({
    queryKey: publicKeys.institutions,
    queryFn: fetchInstitutions,
    select: (data) => data.coreFunctions,
  });

export const usePublicInstitution = (id: number) =>
  useQuery({
    queryKey: publicKeys.institution(id),
    queryFn: () =>
      apiRequest(`/public/institutions/${id}`, { schema: publicInstitutionDetailSchema }),
  });

export const usePublicFindings = (id: number, enabled = true) =>
  useQuery({
    queryKey: publicKeys.findings(id),
    queryFn: async () =>
      (
        await apiRequest(`/public/institutions/${id}/findings`, {
          schema: publicFindingsResponseSchema,
        })
      ).problems,
    enabled,
  });

export const useMethodology = () =>
  useQuery({
    queryKey: publicKeys.methodology,
    queryFn: () => apiRequest('/public/methodology', { schema: methodologySchema }),
    staleTime: 10 * 60_000,
  });
