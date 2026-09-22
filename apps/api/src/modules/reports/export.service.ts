import type { PublicReportsService } from './public-reports.service.js';
import { toCsv } from './csv.js';
import type { ReportsRepository } from './reports.repository.js';

export const exportDatasets = ['instituicoes', 'problemas'] as const;
export type ExportDataset = (typeof exportDatasets)[number];

// Dicionário de dados (dados abertos). Mantido junto das colunas para não divergir.
const DICTIONARY: Record<ExportDataset, [coluna: string, tipo: string, descricao: string][]> = {
  instituicoes: [
    ['instituicao_id', 'inteiro', 'Identificador interno da instituição.'],
    ['sigla', 'texto', 'Sigla da instituição.'],
    ['nome', 'texto', 'Nome da instituição.'],
    ['dominio', 'texto', 'Domínio do portal avaliado.'],
    [
      'situacao',
      'texto',
      'avaliado | sem_dado (a coleta não avaliou nenhuma página; não é 0%) | nao_coletado.',
    ],
    ['coleta_id', 'inteiro', 'Coleta terminada mais recente que incluiu a instituição.'],
    ['coleta_data', 'data ISO 8601', 'Fim da coleta (UTC).'],
    [
      'conformidade',
      'decimal 0–1',
      'Média, entre as páginas avaliadas, de regras aprovadas ÷ (aprovadas + violadas). Só critérios verificáveis automaticamente. Vazio quando sem dado.',
    ],
    ['classificacao', 'texto', 'bom (≥ 0,75) | parcial (≥ 0,50) | critico (< 0,50).'],
    [
      'problemas_confirmados',
      'inteiro',
      'Problemas distintos (elemento + regra) confirmados na validação manual.',
    ],
    [
      'problemas_criticos',
      'inteiro',
      'Problemas confirmados de severidade crítica (impacto critical ou serious no axe-core).',
    ],
    [
      'problemas_template',
      'inteiro',
      'Problemas confirmados presentes em ≥ 80% das páginas avaliadas (mínimo 2 páginas).',
    ],
    [
      'validacao_pendente',
      'inteiro',
      'Achados ainda não revisados pelo auditor (não contam como problema).',
    ],
    ['paginas_avaliadas', 'inteiro', 'Páginas auditadas com sucesso na coleta.'],
    ['paginas_total', 'inteiro', 'Páginas previstas no escopo da coleta.'],
    ['axe_versao', 'texto', 'Versão do axe-core usada na coleta.'],
    ['navegador', 'texto', 'Navegador usado na coleta.'],
  ],
  problemas: [
    ['sigla', 'texto', 'Sigla da instituição.'],
    ['coleta_id', 'inteiro', 'Coleta de origem.'],
    ['regra', 'texto', 'Identificador da regra do axe-core.'],
    ['titulo', 'texto', 'Descrição curta da regra (português, textos do axe-core).'],
    ['criterios_wcag', 'texto', 'Critérios WCAG 2.2 da regra, separados por vírgula.'],
    ['principio', 'texto', 'perceivable | operable | understandable | robust (do menor critério).'],
    ['severidade', 'texto', 'critical | moderate.'],
    ['template', 'booleano', 'true se presente em ≥ 80% das páginas avaliadas.'],
    ['paginas', 'inteiro', 'Páginas em que o problema aparece.'],
    ['ocorrencias', 'inteiro', 'Elementos reprovados, somando as páginas.'],
    ['url_exemplo', 'texto', 'Uma página em que o problema aparece.'],
    ['seletor_exemplo', 'texto', 'Seletor CSS do elemento reprovado.'],
  ],
};

/** Exportação de dados abertos (seção 6): só dados públicos, ou seja, achados confirmados. */
export function createExportService(publicReports: PublicReportsService, repo: ReportsRepository) {
  return {
    csv(dataset: ExportDataset): string {
      const header = DICTIONARY[dataset].map(([name]) => name);
      const institutions = publicReports.list();
      if (dataset === 'instituicoes') {
        return toCsv(
          header,
          institutions.map((i) => {
            const collection = repo.finishedCollectionsOf(i.id).at(-1);
            return [
              i.id,
              i.acronym,
              i.name,
              i.domain,
              { evaluated: 'avaliado', no_data: 'sem_dado', not_collected: 'nao_coletado' }[
                i.status
              ],
              i.collectionId,
              i.collectedAt,
              i.conformity === null ? null : i.conformity.toFixed(4),
              i.classification === null
                ? null
                : { good: 'bom', partial: 'parcial', critical: 'critico' }[i.classification],
              i.problems,
              i.criticalProblems,
              i.templateProblems,
              i.status === 'evaluated' ? i.pendingValidation : null,
              i.pagesEvaluated,
              i.pagesTotal,
              collection?.axeVersion ?? null,
              collection?.browserVersion ?? null,
            ];
          }),
        );
      }
      const rows = institutions
        .filter((i) => i.status === 'evaluated')
        .flatMap((i) =>
          publicReports
            .problems(i.id)
            .map((p) => [
              i.acronym,
              i.collectionId,
              p.ruleId,
              p.title,
              p.wcagCriteria,
              p.principle,
              p.severity,
              p.template,
              p.pages,
              p.occurrences,
              p.example.pageUrl,
              p.example.selector,
            ]),
        );
      return toCsv(header, rows);
    },

    dictionary(): string {
      return toCsv(
        ['conjunto', 'coluna', 'tipo', 'descricao'],
        exportDatasets.flatMap((dataset) => DICTIONARY[dataset].map((row) => [dataset, ...row])),
      );
    },
  };
}

export type ExportService = ReturnType<typeof createExportService>;
