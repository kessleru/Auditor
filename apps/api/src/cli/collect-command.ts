import {
  classifyConformity,
  formatSeconds,
  pageFailureKindLabels,
  pageFunctionLabels,
  type CollectionEvent,
  type PageFunctionKey,
  pageFunctionKeys,
  summarizeReliability,
} from '@auditoria-rf/contracts';
import { toCollectionPage } from '../modules/collections/collections.presenter.js';
import type { Services } from '../services.js';

export interface CollectArgs {
  /** Sigla (ex.: IFTM) ou id da instituição. */
  institution: string;
  functions?: string;
  /** E-mail do auditor responsável; opcional se houver um único auditor. */
  auditor?: string;
}

const CLASS_LABEL = { good: 'Bom', partial: 'Parcial', critical: 'Crítico' } as const;
const percent = (value: number) => `${(value * 100).toFixed(1).replace('.', ',')}%`;

export class CollectCommandError extends Error {}

function parseFunctions(value: string | undefined): PageFunctionKey[] | undefined {
  if (!value) return undefined;
  const keys = value
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
  const invalid = keys.filter((k) => !(pageFunctionKeys as readonly string[]).includes(k));
  if (invalid.length > 0) {
    throw new CollectCommandError(
      `Função desconhecida: ${invalid.join(', ')}. Use: ${pageFunctionKeys.join(', ')}.`,
    );
  }
  return keys as PageFunctionKey[];
}

/**
 * Executa uma coleta pelos mesmos services da API (seção 1.3): cria, aguarda o fim e imprime o ID,
 * as versões usadas e o resumo dos indicadores. Devolve o ID da coleta.
 */
export async function runCollect(
  args: CollectArgs,
  services: Services,
  print: (line: string) => void,
) {
  const wanted = args.institution.trim();
  const institution = services.institutions
    .list()
    .find((i) => String(i.id) === wanted || i.acronym.toUpperCase() === wanted.toUpperCase());
  if (!institution) throw new CollectCommandError(`Instituição não encontrada: ${wanted}.`);

  const auditors = services.auth.listAuditors();
  const auditor = args.auditor
    ? auditors.find((a) => a.email === args.auditor?.trim().toLowerCase())
    : auditors.length === 1
      ? auditors[0]
      : undefined;
  if (!auditor) {
    throw new CollectCommandError(
      auditors.length === 0
        ? 'Nenhum auditor cadastrado. Crie um com npm run create-auditor.'
        : args.auditor
          ? `Auditor não encontrado: ${args.auditor}.`
          : 'Há mais de um auditor: informe --auditor <e-mail>.',
    );
  }

  const functions = parseFunctions(args.functions);
  const created = services.collections.create(
    { institutionIds: [institution.id], ...(functions && { functions }) },
    auditor.id,
  );
  const total = services.collections.getWithProgress(created.id).progress.total;
  print(`Coleta #${created.id} criada: ${institution.acronym}, ${total} página(s).`);

  const unsubscribe = services.collections.subscribe(created.id, (event: CollectionEvent) => {
    if (event.type === 'page-done' || event.type === 'page-failed') {
      const { done, failed } = event.progress;
      const detail =
        event.type === 'page-done'
          ? `${event.page.violationsCount} regra(s) violada(s)`
          : `falhou: ${event.page.error ?? 'erro desconhecido'}`;
      print(`[${done + failed}/${event.progress.total}] ${event.page.url} — ${detail}`);
    }
  });

  const finished = await services.collections.waitForFinish(created.id);
  unsubscribe();

  print(`Situação: ${finished.status}`);
  print(`Versões: axe-core ${finished.axeVersion} · ${finished.browserVersion}`);
  print(`User-agent: ${finished.userAgent}`);

  const reliability = summarizeReliability(
    services.collections.get(finished.id).pages.map(toCollectionPage),
  );
  if (reliability.failures.length > 0) {
    print(
      `Falhas por motivo: ${reliability.failures
        .map(({ kind, count }) => `${pageFailureKindLabels[kind]} ${count}`)
        .join(' · ')}.`,
    );
  }
  if (reliability.loadTime) {
    const { measured, medianMs, maxMs } = reliability.loadTime;
    print(
      `Carregamento: mediana ${formatSeconds(medianMs)}, máximo ${formatSeconds(maxMs)} (${measured} página(s)).`,
    );
  }

  const report = services.reports.summarizeCollection(finished.id, finished.scope);
  if (report.institutions.length > 1) {
    print(
      `Núcleo comum (funções avaliadas em todas): ${
        report.coreFunctions.map((f) => pageFunctionLabels[f]).join(', ') || 'nenhuma'
      }.`,
    );
  }
  for (const { acronym, summary, core, coverage } of report.institutions) {
    const covered = coverage
      ? ` · cobertura ${coverage.found}/${coverage.expected} função(ões)${
          coverage.missing.length > 0
            ? ` (não encontradas: ${coverage.missing.map((f) => pageFunctionLabels[f]).join(', ')})`
            : ''
        }`
      : '';
    if (summary.status === 'no_data' || core.status === 'no_data') {
      print(`${acronym}: sem dado (todas as ${summary.pagesTotal} página(s) falharam).${covered}`);
      continue;
    }
    const conformity =
      core.conformity === null
        ? 'sem regra aplicável'
        : `${percent(core.conformity)} (${CLASS_LABEL[classifyConformity(core.conformity)]})`;
    print(
      `${acronym}: conformidade ${conformity} · ${core.distinctProblems} problema(s) distinto(s)` +
        ` (${core.occurrences} ocorrência(s)) · ${core.templateProblems} de template` +
        ` · ${core.pagesEvaluated}/${summary.pagesTotal} página(s) avaliada(s)${covered}`,
    );
  }
  print('A conformidade cobre apenas critérios verificáveis automaticamente.');

  return finished.id;
}
