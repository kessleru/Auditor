import type { CollectionScope } from '@auditoria-rf/contracts';
import { averageConformity, type InstitutionSummary, summarizeInstitution } from './metrics.js';
import type { ReportsRepository } from './reports.repository.js';

export interface InstitutionReport {
  institutionId: number;
  acronym: string;
  name: string;
  summary: InstitutionSummary;
}

export function createReportsService(repo: ReportsRepository) {
  return {
    /** Indicadores de cada instituição do escopo de uma coleta (seção 3.3). */
    summarizeCollection(collectionId: number, scope: CollectionScope) {
      const pages = repo.pagesOfCollection(collectionId);
      const findings = repo.findingsOfCollection(collectionId);

      const institutions: InstitutionReport[] = scope.institutionIds.map((institutionId) => {
        const own = pages.filter((p) => p.institutionId === institutionId);
        const ownIds = new Set(own.map((p) => p.id));
        const info = repo.institution(institutionId);
        return {
          institutionId,
          acronym: info?.acronym ?? String(institutionId),
          name: info?.name ?? '',
          summary: summarizeInstitution(
            own,
            findings.filter((f) => ownIds.has(f.collectionPageId)),
          ),
        };
      });

      return {
        collectionId,
        institutions,
        averageConformity: averageConformity(institutions.map((i) => i.summary)),
      };
    },
  };
}

export type ReportsService = ReturnType<typeof createReportsService>;
