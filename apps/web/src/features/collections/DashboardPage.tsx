import { Link } from 'react-router';
import {
  ButtonLink,
  ConformityBar,
  EmptyState,
  formatPercent as percent,
  Note,
  PageTitle,
  Skeleton,
  StatCard,
  StatGridSkeleton,
} from '../../components/ui';
import { formatDate, formatNumber } from '../../lib/format';
import { useResultsOverview } from '../results/auditorApi';
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
        <>
          <Skeleton className="-mt-4 h-[18px] w-72 max-w-full" />
          <StatGridSkeleton label="Carregando indicadores…" hints={[false, true, true, false]} />
        </>
      }
    >
      {(data) => (
        <>
          <p className="-mt-4 text-label text-text-muted">
            {data.lastCollectionAt ? `Última coleta: ${formatDate(data.lastCollectionAt)} — ` : ''}
            {data.institutionsTotal} portais cadastrados
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Portais avaliados"
              value={`${data.institutionsEvaluated} de ${data.institutionsTotal}`}
            />
            <StatCard
              label="Problemas distintos"
              value={formatNumber(data.distinctProblems)}
              hint="Inclui não validados."
            />
            <StatCard
              label="Conformidade média"
              value={data.averageConformity === null ? 'Sem dado' : percent(data.averageConformity)}
              hint={
                <Link
                  to="/metodologia"
                  className="text-accent-text underline underline-offset-2 hover:decoration-2"
                >
                  Só critérios automatizáveis
                </Link>
              }
            />
            <StatCard label="Tarefas concluídas" value={`${data.tasks.done}/${data.tasks.total}`} />
          </div>
          {running > 0 ? (
            <Note>
              {running} {running === 1 ? 'coleta em andamento' : 'coletas em andamento'}.{' '}
              <Link to="/coletas" className="underline underline-offset-2 hover:decoration-2">
                Acompanhar
              </Link>
            </Note>
          ) : null}
          <section aria-labelledby="painel-instituicoes" className="flex flex-col gap-3">
            <h2 id="painel-instituicoes" className="text-section text-text">
              Instituições
            </h2>
            <ul className="flex flex-col divide-y divide-border rounded-lg bg-surface shadow-card">
              {data.institutions.map((i) => (
                <li
                  key={i.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
                >
                  {i.status === 'evaluated' ? (
                    <Link
                      to={`/painel/instituicoes/${i.id}`}
                      className="font-medium text-accent-text underline underline-offset-2 hover:decoration-2"
                    >
                      {i.acronym}
                    </Link>
                  ) : (
                    <span className="font-medium text-text-muted">{i.acronym}</span>
                  )}
                  <span className="flex flex-wrap items-center gap-4">
                    {i.status === 'evaluated' ? (
                      <ConformityBar value={i.conformity} label={`Conformidade do ${i.acronym}`} />
                    ) : (
                      <span className="text-label text-text-muted">
                        {i.status === 'no_data' ? 'Sem dado' : 'Ainda não avaliado'}
                      </span>
                    )}
                    <span className="min-w-28 text-right text-label text-text-muted">
                      {i.problems === null ? '—' : `${formatNumber(i.problems)} problemas`}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </QueryState>
  );
}

/** Painel do auditor (tela 4.1); sem coletas, o estado vazio (tela 5.1). */
export function DashboardPage() {
  const collections = useCollections(ALL);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageTitle>Painel de auditoria</PageTitle>
        <ButtonLink to="/auditorias/nova" variant="secondary">
          Nova auditoria
        </ButtonLink>
      </div>
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
    </div>
  );
}
