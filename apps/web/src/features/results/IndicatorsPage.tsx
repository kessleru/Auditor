import {
  indicatorsSchema,
  pageFunctionLabels,
  type SuggestionAccuracy,
} from '@auditoria-rf/contracts';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import {
  buttonClasses,
  DataTable,
  EmptyState,
  formatPercent,
  Note,
  Page,
  PageHeader,
  Section,
} from '../../components/ui';
import { apiRequest } from '../../lib/api';
import { formatNumber } from '../../lib/format';
import { QueryState } from './QueryState';

const RULES_CSV_URL = '/api/v1/reports/indicators/rules.csv';
const RULES_DICTIONARY_URL = '/api/v1/reports/indicators/rules-dictionary.csv';

const useIndicators = () =>
  useQuery({
    queryKey: ['results', 'indicators'],
    queryFn: () => apiRequest('/reports/indicators', { schema: indicatorsSchema }),
  });

const rate = (part: number, total: number) => (total === 0 ? '—' : formatPercent(part / total));

/** Indicadores da pesquisa (auditor): quanto a ferramenta acerta sem revisão humana. */
export function IndicatorsPage() {
  const indicators = useIndicators();
  return (
    <QueryState
      query={indicators}
      loadingText="Carregando indicadores…"
      errorTitle="Não foi possível carregar os indicadores"
    >
      {({ collections, rules, suggestions }) => {
        const validated = rules.reduce((sum, r) => sum + r.confirmed + r.falsePositive, 0);
        const confirmed = rules.reduce((sum, r) => sum + r.confirmed, 0);
        const discovered = suggestions.reduce((sum, s) => sum + s.discovered, 0);
        const hits = suggestions.reduce((sum, s) => sum + s.hits, 0);
        const withRoutes = suggestions.filter(
          (s: SuggestionAccuracy) => s.discovered + s.manual + s.absent > 0,
        );
        return (
          <Page>
            <PageHeader
              title="Indicadores da pesquisa"
              description="Quanto a ferramenta acerta sem revisão humana: a confirmação dos achados do axe e a sugestão de função da descoberta de rotas."
              meta={[
                { label: 'Coletas consideradas', value: formatNumber(collections) },
                {
                  label: 'Taxa de confirmação geral',
                  value: rate(confirmed, validated),
                },
                { label: 'Acerto da sugestão', value: rate(hits, discovered) },
              ]}
            />

            <Section
              title="Validação por regra"
              description="Problemas distintos da coleta mais recente de cada instituição. Taxa de confirmação = confirmados ÷ (confirmados + falsos positivos); pendentes ficam fora."
              actions={
                <div className="flex flex-wrap gap-2">
                  <a href={RULES_CSV_URL} download className={buttonClasses('secondary')}>
                    <Download aria-hidden="true" size={16} strokeWidth={1.75} /> Exportar CSV
                  </a>
                  <a href={RULES_DICTIONARY_URL} download className={buttonClasses('secondary')}>
                    Dicionário de dados
                  </a>
                </div>
              }
            >
              {rules.length === 0 ? (
                <EmptyState title="Nenhum achado nas coletas terminadas" />
              ) : (
                <DataTable
                  caption="Validação por regra"
                  captionHidden
                  rows={rules}
                  rowKey={(r) => r.ruleId}
                  columns={[
                    {
                      key: 'rule',
                      header: 'Regra',
                      rowHeader: true,
                      cell: (r) => (
                        <span className="flex flex-col">
                          <span>{r.title}</span>
                          <code className="font-mono text-code text-text-muted">{r.ruleId}</code>
                        </span>
                      ),
                    },
                    {
                      key: 'problems',
                      header: 'Problemas',
                      align: 'end',
                      cell: (r) => formatNumber(r.problems),
                    },
                    {
                      key: 'confirmed',
                      header: 'Confirmados',
                      align: 'end',
                      cell: (r) => formatNumber(r.confirmed),
                    },
                    {
                      key: 'fp',
                      header: 'Falsos positivos',
                      align: 'end',
                      cell: (r) => formatNumber(r.falsePositive),
                    },
                    {
                      key: 'pending',
                      header: 'Pendentes',
                      align: 'end',
                      cell: (r) => formatNumber(r.pending),
                    },
                    {
                      key: 'rate',
                      header: 'Taxa de confirmação',
                      align: 'end',
                      cell: (r) =>
                        r.confirmationRate === null ? '—' : formatPercent(r.confirmationRate),
                    },
                  ]}
                />
              )}
            </Section>

            <Section
              title="Sugestão de função"
              description="Rotas confirmadas pelo auditor. A sugestão é recalculada com as palavras-chave atuais, a partir do endereço, do título e do texto do link guardados na descoberta."
            >
              {withRoutes.length === 0 ? (
                <EmptyState title="Nenhuma rota confirmada ainda" />
              ) : (
                <DataTable
                  caption="Sugestão de função"
                  captionHidden
                  rows={withRoutes}
                  rowKey={(s) => s.functionKey}
                  columns={[
                    {
                      key: 'fn',
                      header: 'Função',
                      rowHeader: true,
                      cell: (s) => pageFunctionLabels[s.functionKey],
                    },
                    {
                      key: 'discovered',
                      header: 'Descobertas',
                      align: 'end',
                      cell: (s) => formatNumber(s.discovered),
                    },
                    {
                      key: 'hits',
                      header: 'Sugestão certa',
                      align: 'end',
                      cell: (s) =>
                        s.discovered === 0
                          ? '—'
                          : `${formatNumber(s.hits)} (${rate(s.hits, s.discovered)})`,
                    },
                    {
                      key: 'other',
                      header: 'Sugeria outra',
                      align: 'end',
                      cell: (s) => formatNumber(s.otherFunction),
                    },
                    {
                      key: 'none',
                      header: 'Sem sugestão',
                      align: 'end',
                      cell: (s) => formatNumber(s.noSuggestion),
                    },
                    {
                      key: 'manual',
                      header: 'Informadas à mão',
                      align: 'end',
                      cell: (s) => formatNumber(s.manual),
                    },
                    {
                      key: 'absent',
                      header: 'Não encontradas',
                      align: 'end',
                      cell: (s) => formatNumber(s.absent),
                    },
                  ]}
                />
              )}
            </Section>

            <Note title="Como ler">
              A taxa de confirmação mede o quanto o axe acerta sem revisão humana; o falso positivo
              nunca é apagado, por isso a taxa pode ser recalculada a qualquer momento. Na sugestão
              de função, &quot;informadas à mão&quot; são páginas que a descoberta não encontrou e
              &quot;não encontradas&quot;, funções que o portal não tem.
            </Note>
          </Page>
        );
      }}
    </QueryState>
  );
}
