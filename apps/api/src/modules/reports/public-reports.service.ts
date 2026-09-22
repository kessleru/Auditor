import {
  CONFORMITY_THRESHOLDS,
  type Methodology,
  type PublicInstitution,
  type PublicInstitutionDetail,
  type PublicProblem,
  type PublicSummary,
  TEMPLATE_MIN_PAGES,
  TEMPLATE_THRESHOLD,
} from '@auditoria-rf/contracts';
import { AXE_TAGS } from '../../infra/auditor/page-auditor.js';
import { ruleTexts } from '../../infra/auditor/rule-texts.js';
import { NotFoundError } from '../../shared/errors.js';
import { summarizeInstitution } from './metrics.js';
import type { ReportsRepository } from './reports.repository.js';

const mean = (values: (number | null)[]) => {
  const valid = values.filter((v): v is number => v !== null);
  return valid.length === 0 ? null : valid.reduce((a, b) => a + b, 0) / valid.length;
};

type InstitutionRow = NonNullable<ReturnType<ReportsRepository['findInstitution']>>;

/**
 * Visão pública (somente leitura; ADR 0006): cada instituição com a sua coleta terminada mais
 * recente; problemas = só achados confirmados; portal que falhou = ausência de dado.
 */
export function createPublicReportsService(
  repo: ReportsRepository,
  { contactEmail }: { contactEmail: string | null },
) {
  const summarize = (collectionId: number, institutionId: number) => {
    const pages = repo
      .pagesOfCollection(collectionId)
      .filter((p) => p.institutionId === institutionId);
    const findings = repo.findingDetailsOf(collectionId, institutionId);
    return { summary: summarizeInstitution(pages, findings, { problems: 'confirmed' }), findings };
  };

  const view = (institution: InstitutionRow): PublicInstitution => {
    const base = {
      id: institution.id,
      name: institution.name,
      acronym: institution.acronym,
      domain: institution.domain,
    };
    const latest = repo.finishedCollectionsOf(institution.id).at(-1);
    if (!latest) {
      return {
        ...base,
        status: 'not_collected',
        collectionId: null,
        collectedAt: null,
        conformity: null,
        classification: null,
        problems: null,
        criticalProblems: null,
        templateProblems: null,
        pendingValidation: 0,
        pagesEvaluated: 0,
        pagesTotal: 0,
      };
    }
    const { summary } = summarize(latest.id, institution.id);
    const common = {
      ...base,
      collectionId: latest.id,
      collectedAt: latest.finishedAt?.toISOString() ?? null,
      pagesTotal: summary.pagesTotal,
    };
    if (summary.status === 'no_data') {
      return {
        ...common,
        status: 'no_data',
        conformity: null,
        classification: null,
        problems: null,
        criticalProblems: null,
        templateProblems: null,
        pendingValidation: 0,
        pagesEvaluated: 0,
      };
    }
    return {
      ...common,
      status: 'evaluated',
      conformity: summary.conformity,
      classification: summary.classification,
      problems: summary.distinctProblems,
      criticalProblems: summary.criticalProblems,
      templateProblems: summary.templateProblems,
      pendingValidation: summary.pendingValidation,
      pagesEvaluated: summary.pagesEvaluated,
    };
  };

  const rank = { evaluated: 0, no_data: 1, not_collected: 2 } as const;

  const list = (): PublicInstitution[] =>
    repo
      .activeInstitutions()
      .map(view)
      .sort(
        (a, b) =>
          rank[a.status] - rank[b.status] ||
          (b.conformity ?? -1) - (a.conformity ?? -1) ||
          a.acronym.localeCompare(b.acronym),
      );

  const getInstitution = (id: number) => {
    const institution = repo.findInstitution(id);
    if (!institution || !institution.active) throw new NotFoundError('Instituição não encontrada.');
    return institution;
  };

  return {
    list,

    summary(): PublicSummary {
      const rows = list();
      const dates = rows
        .map((r) => r.collectedAt)
        .filter((d): d is string => d !== null)
        .sort();
      const evaluated = rows.filter((r) => r.status === 'evaluated');
      return {
        lastCollectionAt: dates.at(-1) ?? null,
        institutionsTotal: rows.length,
        institutionsEvaluated: evaluated.length,
        // Média só entre instituições avaliadas: sem dado fica fora (seção 3.2.8).
        averageConformity: mean(evaluated.map((r) => r.conformity)),
      };
    },

    detail(id: number): PublicInstitutionDetail {
      const institution = getInstitution(id);
      const history = repo.finishedCollectionsOf(id).flatMap((collection) => {
        if (!collection.finishedAt) return [];
        const { summary } = summarize(collection.id, id);
        return [
          {
            collectionId: collection.id,
            collectedAt: collection.finishedAt.toISOString(),
            conformity: summary.status === 'evaluated' ? summary.conformity : null,
          },
        ];
      });
      return { institution: view(institution), history };
    },

    /** Problemas distintos confirmados da coleta mais recente, com um exemplo de cada. */
    problems(id: number): PublicProblem[] {
      getInstitution(id);
      const latest = repo.finishedCollectionsOf(id).at(-1);
      if (!latest) return [];
      const { summary, findings } = summarize(latest.id, id);
      if (summary.status !== 'evaluated') return [];

      return summary.problems.map((problem) => {
        const example = findings.find(
          (f) => f.fingerprint === problem.fingerprint && f.validation === 'confirmed',
        );
        if (!example) throw new Error(`Achado sem exemplo: ${problem.fingerprint}`);
        return {
          fingerprint: problem.fingerprint,
          ruleId: problem.ruleId,
          ...ruleTexts(problem.ruleId, example.help),
          helpUrl: example.helpUrl,
          wcagCriteria: problem.wcagCriteria,
          principle: example.principle,
          severity: problem.severity,
          template: problem.template,
          pages: problem.pages,
          occurrences: problem.occurrences,
          example: {
            pageUrl: example.pageUrl,
            selector: example.selector,
            htmlSnippet: example.htmlSnippet,
          },
        };
      });
    },

    methodology(): Methodology {
      const last = repo.lastFinishedCollection();
      return {
        axeVersion: last?.axeVersion ?? null,
        browserVersion: last?.browserVersion ?? null,
        lastCollectionAt: last?.finishedAt?.toISOString() ?? null,
        axeTags: AXE_TAGS,
        thresholds: { ...CONFORMITY_THRESHOLDS },
        templateThreshold: TEMPLATE_THRESHOLD,
        templateMinPages: TEMPLATE_MIN_PAGES,
        contactEmail,
      };
    },
  };
}

export type PublicReportsService = ReturnType<typeof createPublicReportsService>;
