import type {
  AuditorInstitution,
  AuditorInstitutionDetail,
  PublicInstitution,
  ResultsOverview,
} from '@auditoria-rf/contracts';
import type { InspectionsService } from '../inspections/inspections.service.js';
import type { PublicReportsService } from './public-reports.service.js';

/**
 * Resultados do auditor (telas 4.1, 4.2, 4.3; ADR 0009): mesma coleta da visão pública, problemas =
 * tudo que não é falso positivo, com a situação da camada manual.
 */
export function createResultsService(
  reports: PublicReportsService,
  inspections: InspectionsService,
) {
  const withInspection = (row: PublicInstitution): AuditorInstitution => {
    if (row.status !== 'evaluated' || row.collectionId === null)
      return { ...row, inspection: null, tasks: null };
    const portal = inspections.portalStatus(row.collectionId, row.id);
    return {
      ...row,
      inspection: portal ? portal.status : 'not_in_sample',
      tasks: portal ? portal.tasks : null,
    };
  };

  return {
    overview(): ResultsOverview {
      const institutions = reports.list().map(withInspection);
      const summary = reports.summary();
      return {
        ...summary,
        distinctProblems: institutions.reduce((sum, i) => sum + (i.problems ?? 0), 0),
        tasks: institutions.reduce(
          (acc, i) => ({
            done: acc.done + (i.tasks?.done ?? 0),
            total: acc.total + (i.tasks?.total ?? 0),
          }),
          { done: 0, total: 0 },
        ),
        institutions,
      };
    },

    detail(id: number): AuditorInstitutionDetail {
      const { institution, history } = reports.detail(id);
      const row = withInspection(institution);
      return {
        institution: row,
        history,
        problems: reports.problems(id),
        manual:
          row.collectionId !== null && row.inspection !== null && row.inspection !== 'not_in_sample'
            ? inspections.manualFindings(row.collectionId, id)
            : { tasks: [], barriers: [] },
      };
    },
  };
}

export type ResultsService = ReturnType<typeof createResultsService>;
