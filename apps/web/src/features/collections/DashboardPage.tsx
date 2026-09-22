import { ButtonLink, EmptyState, PageTitle } from '../../components/ui';
import { QueryState } from '../results/QueryState';
import { FINISHED_STATUSES, useCollections } from './api';

const ALL = ['queued', 'running', 'completed', 'partial', 'cancelled'] as const;

/** Painel do auditor. Nesta fase, só o estado vazio (tela 5.1); os indicadores chegam na Fase 9. */
export function DashboardPage() {
  const collections = useCollections(ALL);
  return (
    <div className="flex flex-col gap-6">
      <PageTitle>Painel de auditoria</PageTitle>
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
          const latest = rows[0];
          return (
            <section className="flex flex-col gap-3 rounded-lg bg-surface p-5 shadow-card">
              <h2 className="text-card text-text">Coletas</h2>
              <p className="text-body text-text-muted">
                {running.length > 0
                  ? `${running.length} coleta(s) em andamento.`
                  : 'Nenhuma coleta em andamento.'}{' '}
                Os indicadores consolidados deste painel chegam na próxima etapa do projeto.
              </p>
              <div className="flex flex-wrap gap-3">
                {latest ? (
                  <ButtonLink to={`/coletas/${latest.id}`}>Ver a coleta mais recente</ButtonLink>
                ) : null}
                <ButtonLink to="/historico" variant="secondary">
                  Histórico
                </ButtonLink>
              </div>
            </section>
          );
        }}
      </QueryState>
    </div>
  );
}
