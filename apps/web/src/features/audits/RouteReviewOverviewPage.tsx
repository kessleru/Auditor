import { pageFunctionLabels } from '@auditoria-rf/contracts';
import { useQueries } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router';
import {
  Badge,
  Button,
  ButtonLink,
  DataTable,
  EmptyState,
  ErrorState,
  Page,
  PageHeader,
  Stepper,
} from '../../components/ui';
import { ApiError } from '../../lib/api';
import { useCreateCollection } from '../collections/api';
import { QueryState } from '../results/QueryState';
import { auditKeys, fetchRoutes, useInstitutions } from './api';
import { isScopeValid, parseScope, scopeSearch } from './scope';

/** Tela 1.2 (visão geral): andamento da revisão de rotas de cada instituição do escopo. */
export function RouteReviewOverviewPage() {
  const [searchParams] = useSearchParams();
  const scope = parseScope(searchParams);
  const search = scopeSearch(scope);
  const institutions = useInstitutions();
  const createCollection = useCreateCollection();
  const navigate = useNavigate();

  const routeQueries = useQueries({
    queries: scope.institutionIds.map((id) => ({
      queryKey: auditKeys.routes(id),
      queryFn: () => fetchRoutes(id),
    })),
  });

  if (!isScopeValid(scope)) {
    return (
      <Page>
        <PageHeader title="Revisão de rotas" />
        <EmptyState
          title="Escopo incompleto"
          description="Escolha as instituições e as páginas avaliadas antes de revisar as rotas."
          action={<ButtonLink to="/auditorias/nova">Definir o escopo</ButtonLink>}
        />
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        title="Revisão de rotas"
        breadcrumb={<Stepper current={1} />}
        description={`Para cada instituição, confirme a URL de cada página avaliada ou marque que o portal não tem a página (isso entra na cobertura): ${scope.functions
          .map((f) => pageFunctionLabels[f])
          .join(', ')}.`}
      />

      <QueryState
        query={institutions}
        loadingText="Carregando instituições…"
        errorTitle="Não foi possível carregar as instituições"
      >
        {(all) => {
          const rows = scope.institutionIds.map((id, index) => {
            const institution = all.find((i) => i.id === id);
            const data = routeQueries[index]?.data;
            const confirmed = scope.functions.filter((f) =>
              data?.routes.some((r) => r.status === 'confirmed' && r.functionKey === f),
            ).length;
            // Revisada = rota confirmada ou marcada como não encontrada (entra na cobertura).
            const absent = scope.functions.filter((f) =>
              data?.absences.some((a) => a.functionKey === f),
            ).length;
            return {
              id,
              institution,
              confirmed,
              absent,
              reviewed: confirmed + absent,
              loading: routeQueries[index]?.isPending ?? true,
            };
          });
          const pending = rows.filter((r) => r.reviewed < scope.functions.length);
          const ready = rows.length > 0 && pending.length === 0 && rows.every((r) => !r.loading);

          const start = () =>
            createCollection.mutate(
              { institutionIds: scope.institutionIds, functions: scope.functions },
              { onSuccess: ({ collection }) => void navigate(`/coletas/${collection.id}`) },
            );

          return (
            <>
              <DataTable
                caption="Revisão de rotas por instituição"
                captionHidden
                rows={rows}
                rowKey={(row) => row.id}
                columns={[
                  {
                    key: 'institution',
                    header: 'Instituição',
                    rowHeader: true,
                    cell: (row) => (
                      <span className="flex flex-col">
                        <span className="font-medium">
                          {row.institution?.acronym ?? `#${row.id}`}
                        </span>
                        <span className="text-label text-text-muted">
                          {row.institution?.domain}
                        </span>
                      </span>
                    ),
                  },
                  {
                    key: 'status',
                    header: 'Funções revisadas',
                    cell: (row) =>
                      row.loading ? (
                        <span className="text-text-muted">Carregando…</span>
                      ) : (
                        <span className="flex flex-col items-start gap-1">
                          <Badge
                            variant={row.reviewed === scope.functions.length ? 'good' : 'moderate'}
                          >
                            {row.reviewed} de {scope.functions.length}
                          </Badge>
                          <span className="text-label text-text-muted">
                            {row.confirmed} {row.confirmed === 1 ? 'confirmada' : 'confirmadas'},{' '}
                            {row.absent} não {row.absent === 1 ? 'encontrada' : 'encontradas'}
                          </span>
                        </span>
                      ),
                  },
                  {
                    key: 'action',
                    header: 'Ação',
                    align: 'end',
                    cell: (row) => (
                      <Link
                        to={`/auditorias/nova/rotas/${row.id}${search}`}
                        aria-label={`Revisar rotas do ${row.institution?.acronym ?? row.id}`}
                        className="text-accent-text underline underline-offset-2 hover:decoration-2"
                      >
                        Revisar rotas
                      </Link>
                    ),
                  },
                ]}
              />

              {createCollection.error ? (
                <div role="alert">
                  <ErrorState
                    title="Não foi possível iniciar a coleta"
                    description={
                      createCollection.error instanceof ApiError
                        ? createCollection.error.message
                        : 'Tente de novo em instantes.'
                    }
                  />
                </div>
              ) : null}

              {!ready && pending.length > 0 ? (
                <p className="text-body text-text-muted">
                  Falta confirmar a rota ou marcar como não encontrada em:{' '}
                  {pending.map((r) => r.institution?.acronym ?? r.id).join(', ')}.
                </p>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <Button onClick={start} disabled={!ready || createCollection.isPending}>
                  {createCollection.isPending ? 'Iniciando…' : 'Iniciar coleta'}
                </Button>
                <ButtonLink to={`/auditorias/nova${search}`} variant="secondary">
                  Voltar ao escopo
                </ButtonLink>
              </div>
            </>
          );
        }}
      </QueryState>
    </Page>
  );
}
