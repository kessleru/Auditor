import type { CollectionScope } from '@auditoria-rf/contracts';
import {
  averageConformity,
  commonCore,
  type Coverage,
  coverageOf,
  evaluatedFunctions,
  type InstitutionSummary,
  summarizeInstitution,
} from './metrics.js';
import type { ReportsRepository } from './reports.repository.js';

export interface InstitutionReport {
  institutionId: number;
  acronym: string;
  name: string;
  /** Todas as páginas avaliadas. */
  summary: InstitutionSummary;
  /** Só o núcleo comum da coleta: o que se compara entre instituições (ADR 0013). */
  core: InstitutionSummary;
  coverage: Coverage | null;
}

export function createReportsService(repo: ReportsRepository) {
  return {
    /** Indicadores de cada instituição do escopo de uma coleta (seção 3.3). */
    summarizeCollection(collectionId: number, scope: CollectionScope) {
      const pages = repo.pagesOfCollection(collectionId);
      const findings = repo.findingsOfCollection(collectionId);

      const perInstitution = scope.institutionIds.map((institutionId) => {
        const own = pages.filter((p) => p.institutionId === institutionId);
        const ownIds = new Set(own.map((p) => p.id));
        return {
          institutionId,
          own,
          ownFindings: findings.filter((f) => ownIds.has(f.collectionPageId)),
        };
      });
      const summaries = perInstitution.map(({ own, ownFindings }) =>
        summarizeInstitution(own, ownFindings),
      );
      const core = commonCore(
        perInstitution
          .filter((_, i) => summaries[i]?.status === 'evaluated')
          .map(({ own }) => evaluatedFunctions(own)),
      );

      const institutions: InstitutionReport[] = perInstitution.map(
        ({ institutionId, own, ownFindings }, i) => {
          const info = repo.institution(institutionId);
          return {
            institutionId,
            acronym: info?.acronym ?? String(institutionId),
            name: info?.name ?? '',
            summary: summaries[i] as InstitutionSummary,
            core: summarizeInstitution(own, ownFindings, { functions: core }),
            coverage: coverageOf(own, scope.functions),
          };
        },
      );

      return {
        collectionId,
        institutions,
        coreFunctions: core,
        averageConformity: averageConformity(institutions.map((i) => i.core)),
      };
    },
  };
}

export type ReportsService = ReturnType<typeof createReportsService>;
