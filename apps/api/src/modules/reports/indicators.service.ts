import {
  type FindingValidation,
  type Indicators,
  pageFunctionKeys,
  type RuleValidation,
  type SuggestionAccuracy,
} from '@auditoria-rf/contracts';
import { ruleTexts } from '../../infra/auditor/rule-texts.js';
import { suggestFunction } from '../../infra/crawler/suggest-function.js';
import { toCsv } from './csv.js';
import { analyzeFingerprints } from './fingerprint-analysis.js';
import type { ReportsRepository } from './reports.repository.js';

/** Colunas do CSV de validação por regra, com o dicionário ao lado (não divergem). */
const RULES_CSV: [coluna: string, descricao: string][] = [
  ['regra', 'Identificador da regra do axe-core.'],
  ['titulo', 'Descrição curta da regra (português).'],
  [
    'problemas',
    'Problemas distintos (elemento + regra) na coleta mais recente de cada instituição.',
  ],
  ['confirmados', 'Problemas confirmados na validação manual.'],
  ['falsos_positivos', 'Problemas registrados como falso positivo (com justificativa).'],
  ['pendentes', 'Problemas ainda não validados.'],
  [
    'taxa_confirmacao',
    'confirmados ÷ (confirmados + falsos_positivos), de 0 a 1; vazio sem validação.',
  ],
];

const hostOf = (url: string) => new URL(url).hostname;

/**
 * Host do portal de cada instituição: o mais frequente entre os endereços descobertos. A
 * descoberta rastreia só a origem do portal, que pode não ser `www.<domínio>` (a página inicial
 * pode redirecionar para `portal.<domínio>`); links de outro subdomínio são poucos.
 */
export function portalHosts(urls: readonly { institutionId: number; url: string }[]) {
  const counts = new Map<number, Map<string, number>>();
  for (const { institutionId, url } of urls) {
    const hosts = counts.get(institutionId) ?? new Map<string, number>();
    hosts.set(hostOf(url), (hosts.get(hostOf(url)) ?? 0) + 1);
    counts.set(institutionId, hosts);
  }
  return new Map(
    [...counts].map(([institutionId, hosts]) => [
      institutionId,
      [...hosts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] as string,
    ]),
  );
}

/**
 * Indicadores da pesquisa para o auditor: taxa de confirmação por regra (quanto o axe acerta sem
 * revisão humana; seção 3.4) e acerto da sugestão de função da descoberta (ADR 0011).
 */
export function createIndicatorsService(repo: ReportsRepository) {
  const ruleValidation = () => {
    const byRule = new Map<string, Map<string, FindingValidation>>();
    const helpOf = new Map<string, string>();
    const collections = new Set<number>();
    for (const institution of repo.activeInstitutions()) {
      const latest = repo.finishedCollectionsOf(institution.id).at(-1);
      if (!latest) continue;
      collections.add(latest.id);
      for (const finding of repo.findingDetailsOf(latest.id, institution.id)) {
        // A validação vale para o problema inteiro (fingerprint) naquela coleta.
        const problems = byRule.get(finding.ruleId) ?? new Map<string, FindingValidation>();
        problems.set(`${latest.id} ${finding.fingerprint}`, finding.validation);
        byRule.set(finding.ruleId, problems);
        helpOf.set(finding.ruleId, finding.help);
      }
    }
    const rules: RuleValidation[] = [...byRule].map(([ruleId, problems]) => {
      const states = [...problems.values()];
      const count = (state: FindingValidation) => states.filter((s) => s === state).length;
      const confirmed = count('confirmed');
      const falsePositive = count('false_positive');
      return {
        ruleId,
        title: ruleTexts(ruleId, helpOf.get(ruleId) ?? ruleId).title,
        problems: states.length,
        confirmed,
        falsePositive,
        pending: count('pending'),
        confirmationRate:
          confirmed + falsePositive === 0 ? null : confirmed / (confirmed + falsePositive),
      };
    });
    rules.sort((a, b) => b.problems - a.problems || a.ruleId.localeCompare(b.ruleId));
    return { collections: collections.size, rules };
  };

  const suggestionAccuracy = (): SuggestionAccuracy[] => {
    const rows = new Map(
      pageFunctionKeys.map((functionKey) => [
        functionKey,
        {
          functionKey,
          discovered: 0,
          hits: 0,
          otherFunction: 0,
          noSuggestion: 0,
          manual: 0,
          absent: 0,
        },
      ]),
    );
    const portalHostOf = portalHosts(repo.discoveredUrls());
    for (const route of repo.confirmedRoutesWithEvidence()) {
      const row = rows.get(route.functionKey);
      if (!row) continue;
      if (route.source === 'manual') {
        row.manual++;
        continue;
      }
      row.discovered++;
      const suggested = suggestFunction({
        url: route.url,
        title: route.title ?? undefined,
        linkText: route.linkText ?? undefined,
        // Link para outro subdomínio da instituição: a descoberta sugere também pelo host.
        includeHost: hostOf(route.url) !== portalHostOf.get(route.institutionId),
      });
      if (suggested === route.functionKey) row.hits++;
      else if (suggested === null) row.noSuggestion++;
      else row.otherFunction++;
    }
    for (const functionKey of repo.functionAbsences()) {
      const row = rows.get(functionKey);
      if (row) row.absent++;
    }
    return [...rows.values()];
  };

  return {
    indicators(): Indicators {
      return { ...ruleValidation(), suggestions: suggestionAccuracy() };
    },

    /** CSV da validação por regra, e o dicionário das colunas. */
    rulesCsv(): string {
      return toCsv(
        RULES_CSV.map(([name]) => name),
        ruleValidation().rules.map((r) => [
          r.ruleId,
          r.title,
          r.problems,
          r.confirmed,
          r.falsePositive,
          r.pending,
          r.confirmationRate === null ? null : r.confirmationRate.toFixed(4),
        ]),
      );
    },

    rulesDictionary(): string {
      return toCsv(['coluna', 'descricao'], RULES_CSV);
    },

    /**
     * Como o agrupamento dos problemas (regra + seletor, ADR 0003) se compara com outras chaves,
     * por instituição, numa coleta. Só mede: nada é regravado.
     */
    fingerprintReport(collectionId: number) {
      const pages = repo.pagesOfCollection(collectionId);
      const institutionIds = [...new Set(pages.map((p) => p.institutionId))];
      return institutionIds
        .map((institutionId) => {
          const evaluated = new Set(
            pages
              .filter((p) => p.institutionId === institutionId && p.status === 'done')
              .map((p) => p.id),
          );
          const findings = repo
            .findingDetailsOf(collectionId, institutionId)
            .filter((f) => evaluated.has(f.collectionPageId))
            .map((f) => ({
              pageId: f.collectionPageId,
              ruleId: f.ruleId,
              selector: f.selector,
              htmlSnippet: f.htmlSnippet,
            }));
          return {
            acronym: repo.findInstitution(institutionId)?.acronym ?? `#${institutionId}`,
            analysis: analyzeFingerprints(findings, evaluated.size),
          };
        })
        .sort((a, b) => a.acronym.localeCompare(b.acronym));
    },
  };
}

export type IndicatorsService = ReturnType<typeof createIndicatorsService>;
