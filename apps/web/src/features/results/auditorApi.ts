import { auditorInstitutionDetailSchema, resultsOverviewSchema } from '@auditoria-rf/contracts';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../lib/api';

export const useResultsOverview = () =>
  useQuery({
    queryKey: ['results', 'overview'],
    queryFn: () => apiRequest('/reports/overview', { schema: resultsOverviewSchema }),
  });

export const useAuditorInstitution = (id: number) =>
  useQuery({
    queryKey: ['results', 'institutions', id],
    queryFn: () =>
      apiRequest(`/reports/institutions/${id}`, { schema: auditorInstitutionDetailSchema }),
  });

export const CSV_URL = '/api/v1/public/export.csv';
export const CSV_PROBLEMS_URL = '/api/v1/public/export.csv?conjunto=problemas';
export const CSV_DICTIONARY_URL = '/api/v1/public/export-dictionary.csv';
