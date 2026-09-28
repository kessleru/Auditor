import {
  CONFORMITY_THRESHOLDS,
  type Methodology,
  type PageFunctionKey,
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
import { commonCore, coverageOf, evaluatedFunctions, summarizeInstitution } from './metrics.js';
import type { ReportsRepository } from './reports.repository.js';
import { findingExample } from '../findings/finding-example.js';

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
  {
    contactEmail,
    problems: countedProblems = 'confirmed',
  }: {
    contactEmail: string | null;
    /** `confirmed` = visão pública; `valid` = visão do auditor (tudo que não é falso positivo). */
    problems?: 'confirmed' | 'valid';
  },
) {
  const summarize = (collectionId: number, institutionId: number) => {
    const pages = repo
      .pagesOfCollection(collectionId)
      .filter((p) => p.institutionId === institutionId);
    const findings = repo.findingDetailsOf(collectionId, institutionId);
    return {
      pages,
      summary: summarizeInstitution(pages, findings, { problems: countedProblems }),
      findings,
    };
  };

  /** Coleta terminada mais recente de cada instituição ativa, com as páginas e o resumo geral. */
  const latestOf = (institution: InstitutionRow) => {
    const latest = repo.finishedCollectionsOf(institution.id).at(-1);
    if (!latest) return { institution, latest: null, evaluated: new Set<PageFunctionKey>() };
    const { pages, summary, findings } = summarize(latest.id, institution.id);
    return { institution, latest, pages, findings, summary, evaluated: evaluatedFunctions(pages) };
  };

  const view = (
    entry: ReturnType<typeof latestOf>,
    core: readonly PageFunctionKey[],
  ): PublicInstitution => {
    const { institution } = entry;
    const base = {
      id: institution.id,
      name: institution.name,
      acronym: institution.acronym,
      domain: institution.domain,
    };
    const empty = {
      conformity: null,
      classification: null,
      problems: null,
      criticalProblems: null,
      templateProblems: null,
      pendingValidation: 0,
      reviewNeeded: null,
      pagesEvaluated: 0,
      overall: null,
    };
    if (!entry.latest || !entry.pages || !entry.findings || !entry.summary) {
      return {
        ...base,
        ...empty,
        status: 'not_collected',
        collectionId: null,
        collectedAt: null,
        pagesTotal: 0,
        coverage: null,
      };
    }
    const common = {
      ...base,
      collectionId: entry.latest.id,
      collectedAt: entry.latest.finishedAt?.toISOString() ?? null,
      pagesTotal: entry.summary.pagesTotal,
      coverage: coverageOf(entry.pages, entry.latest.functions),
    };
    if (entry.summary.status === 'no_data') {
      return { ...common, ...empty, status: 'no_data' };
    }
    // Números do ranking: só as páginas das funções do núcleo comum (ADR 0013).
    // Recalcula sobre o que já foi lido, sem consultar o banco de novo.
    const inCore = summarizeInstitution(entry.pages, entry.findings, {
      problems: countedProblems,
      functions: core,
    });
    const ranked = inCore.status === 'evaluated' ? inCore : null;
    return {
      ...common,
      status: 'evaluated',
      conformity: ranked?.conformity ?? null,
      classification: ranked?.classification ?? null,
      problems: ranked?.distinctProblems ?? 0,
      criticalProblems: ranked?.criticalProblems ?? 0,
      templateProblems: ranked?.templateProblems ?? 0,
      pendingValidation: entry.summary.pendingValidation,
      reviewNeeded: entry.summary.incompleteRules,
      pagesEvaluated: ranked?.pagesEvaluated ?? 0,
      overall: {
        conformity: entry.summary.conformity,
        problems: entry.summary.distinctProblems,
        pagesEvaluated: entry.summary.pagesEvaluated,
      },
    };
  };

  const rank = { evaluated: 0, no_data: 1, not_collected: 2 } as const;

  /** Todas as instituições ativas, medidas sobre o núcleo comum das avaliadas. */
  const snapshot = () => {
    const entries = repo.activeInstitutions().map(latestOf);
    const core = commonCore(
      entries.filter((e) => e.summary?.status === 'evaluated').map((e) => e.evaluated),
    );
    const institutions = entries
      .map((e) => view(e, core))
      .sort(
        (a, b) =>
          rank[a.status] - rank[b.status] ||
          (b.conformity ?? -1) - (a.conformity ?? -1) ||
          a.acronym.localeCompare(b.acronym),
      );
    return { institutions, core };
  };

  const list = (): PublicInstitution[] => snapshot().institutions;

  const getInstitution = (id: number) => {
    const institution = repo.findInstitution(id);
    if (!institution || !institution.active) throw new NotFoundError('Instituição não encontrada.');
    return institution;
  };

  return {
    list,
    snapshot,

    summary(): PublicSummary {
      const { institutions: rows, core } = snapshot();
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
        coreFunctions: core,
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
      const row = snapshot().institutions.find((r) => r.id === institution.id);
      if (!row) throw new NotFoundError('Instituição não encontrada.');
      return { institution: row, history };
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
          (f) =>
            f.fingerprint === problem.fingerprint &&
            (countedProblems === 'confirmed'
              ? f.validation === 'confirmed'
              : f.validation !== 'false_positive'),
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
          validation: example.validation,
          template: problem.template,
          pages: problem.pages,
          occurrences: problem.occurrences,
          example: findingExample(example),
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
