import { Link } from 'react-router';
import {
  ButtonLink,
  ConformityBar,
  DataTable,
  EmptyState,
  formatPercent as percent,
  Note,
  Page,
  PageHeader,
  Section,
  StatGroup,
  StatGroupSkeleton,
} from '../../components/ui';
import { formatDate, formatNumber } from '../../lib/format';
import { useResultsOverview } from '../results/auditorApi';
import { NotCollectedList } from '../results/NotCollectedList';
import { QueryState } from '../results/QueryState';
import { FINISHED_STATUSES, useCollections } from './api';

const ALL = ['queued', 'running', 'completed', 'partial', 'cancelled'] as const;

/** Indicadores da coleta mais recente de cada instituição (tela 4.1). */
function Overview({ running }: { running: number }) {
  const overview = useResultsOverview();
  return (
    <QueryState
      query={overview}
      loadingText="Carregando indicadores…"
      errorTitle="Não foi possível carregar os indicadores"
      skeleton={
        <StatGroupSkeleton
          count={4}
          label="Carregando indicadores…"
          hints={[false, true, true, false]}
        />
      }
    >
      {(data) => (
        <>
          <StatGroup
            label="Indicadores da última coleta"
            stats={[
              {
                label: 'Portais avaliados',
                value: `${data.institutionsEvaluated} de ${data.institutionsTotal}`,
                hint: data.lastCollectionAt
                  ? `Última coleta em ${formatDate(data.lastCollectionAt)}`
                  : 'Nenhuma coleta concluída',
              },
              {
                label: 'Problemas distintos',
                value: formatNumber(data.distinctProblems),
                hint: 'Inclui não validados.',
              },
              {
                label: 'Conformidade média',
                value:
                  data.averageConformity === null ? 'Sem dado' : percent(data.averageConformity),
                hint: (
                  <Link
                    to="/metodologia"
                    className="text-accent-text underline underline-offset-2 hover:decoration-2"
                  >
                    Só critérios automatizáveis
                  </Link>
                ),
              },
              { label: 'Tarefas concluídas', value: `${data.tasks.done}/${data.tasks.total}` },
            ]}
          />
          {running > 0 ? (
            <Note>
              {running} {running === 1 ? 'coleta em andamento' : 'coletas em andamento'}.{' '}
              <Link to="/coletas" className="underline underline-offset-2 hover:decoration-2">
                Acompanhar
              </Link>
            </Note>
          ) : null}
          <Section title="Instituições">
            {/* Mesma tabela da visão pública: nome como link, números à direita. */}
            <DataTable
              caption="Conformidade e problemas por instituição na última coleta"
              captionHidden
              rows={data.institutions.filter((row) => row.status !== 'not_collected')}
              rowKey={(row) => row.id}
              columns={[
                {
                  key: 'institution',
                  header: 'Instituição',
                  rowHeader: true,
                  cell: (row) =>
                    row.status === 'evaluated' ? (
                      <Link
                        to={`/painel/instituicoes/${row.id}`}
                        aria-label={`Abrir relatório do ${row.acronym}`}
                        className="font-medium text-accent-text underline-offset-2 hover:underline"
                      >
                        {row.acronym}
                      </Link>
                    ) : (
                      <span className="font-medium text-text-muted">{row.acronym}</span>
                    ),
                },
                {
                  key: 'conformity',
                  header: 'Conformidade',
                  cell: (row) =>
                    row.status === 'evaluated' ? (
                      <ConformityBar
                        value={row.conformity}
                        label={`Conformidade do ${row.acronym}`}
                      />
                    ) : (
                      <span className="text-label text-text-muted">
                        {row.status === 'no_data' ? 'Sem dado' : 'Ainda não avaliado'}
                      </span>
                    ),
                },
                {
                  key: 'problems',
                  header: 'Problemas',
                  align: 'end',
                  cell: (row) => (row.problems === null ? '—' : formatNumber(row.problems)),
                },
              ]}
            />
            <NotCollectedList
              rows={data.institutions.filter((row) => row.status === 'not_collected')}
            />
          </Section>
        </>
      )}
    </QueryState>
  );
}

/** Painel do auditor (tela 4.1); sem coletas, o estado vazio (tela 5.1). */
export function DashboardPage() {
  const collections = useCollections(ALL);
  return (
    <Page>
      <PageHeader
        title="Painel de auditoria"
        description="Como está cada portal na coleta mais recente."
        actions={
          <ButtonLink to="/auditorias/nova" variant="secondary">
            Nova auditoria
          </ButtonLink>
        }
      />
      <QueryState
        query={collections}
        loadingText="Carregando…"
        errorTitle="Não foi possível carregar o painel"
      >
        {(rows) => {
          if (rows.length === 0) {
            return (
              <>
                <EmptyState
                  title="Nenhuma coleta realizada ainda"
                  description="Ao iniciar a primeira auditoria, os portais selecionados são avaliados quanto à WCAG 2.2. Os resultados ficam registrados com data e hora, permitindo comparar coletas ao longo do semestre."
                  action={<ButtonLink to="/auditorias/nova">Iniciar primeira auditoria</ButtonLink>}
                />
                <section className="flex flex-col gap-2 rounded-lg bg-surface p-5 shadow-card">
                  <h2 className="text-card text-text">O que acontece depois da coleta</h2>
                  <ol className="list-decimal space-y-1 pl-5 text-body text-text-muted">
                    <li>
                      A ferramenta avalia cada página e classifica as violações por princípio da
                      WCAG e por severidade.
                    </li>
                    <li>
                      Você valida os achados e registra a inspeção manual — tarefas-alvo e
                      verificação assistiva.
                    </li>
                    <li>
                      O relatório reúne os dois tipos de achado, com o trecho de código e a
                      recomendação de correção.
                    </li>
                  </ol>
                </section>
              </>
            );
          }
          const running = rows.filter((r) => !FINISHED_STATUSES.includes(r.status));
          return <Overview running={running.length} />;
        }}
      </QueryState>
    </Page>
  );
}
