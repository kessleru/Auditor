import { type AuditDraft, isDiscoveryActive, pageFunctionLabels } from '@auditoria-rf/contracts';
import { useQueries } from '@tanstack/react-query';
import { useRef } from 'react';
import { Link, useNavigate } from 'react-router';
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
import { useThrottledAnnouncement } from '../../lib/useThrottledAnnouncement';
import { QueryState } from '../results/QueryState';
import {
  auditKeys,
  fetchRoutes,
  useAuditDraft,
  useDiscoveries,
  useInstitutions,
  useRememberDraftPosition,
  useStartAuditDraft,
  useStartDiscoveries,
} from './api';
import { DiscardDraft, discoveryCounts, discoveryShortText } from './draftParts';

/** Tela 1.2 (visão geral): revisão de rotas e descoberta de cada instituição do escopo salvo. */
export function RouteReviewOverviewPage() {
  const draft = useAuditDraft();
  return (
    <QueryState
      query={draft}
      loadingText="Carregando a auditoria em montagem…"
      errorTitle="Não foi possível carregar a auditoria em montagem"
    >
      {(saved) =>
        saved && saved.scope.institutionIds.length > 0 && saved.scope.functions.length > 0 ? (
          <Overview draft={saved} />
        ) : (
          <Page>
            <PageHeader title="Revisão de rotas" />
            <EmptyState
              title="Nenhuma auditoria em montagem"
              description="Escolha as instituições e as páginas avaliadas antes de revisar as rotas."
              action={<ButtonLink to="/auditorias/nova">Definir o escopo</ButtonLink>}
            />
          </Page>
        )
      }
    </QueryState>
  );
}

function Overview({ draft }: { draft: AuditDraft }) {
  const { scope } = draft;
  const institutions = useInstitutions();
  const discoveries = useDiscoveries(scope.institutionIds);
  const startDiscoveries = useStartDiscoveries(scope.institutionIds);
  const startCollection = useStartAuditDraft();
  const navigate = useNavigate();
  useRememberDraftPosition(draft, { step: 'routes', institutionId: null });

  const routeQueries = useQueries({
    queries: scope.institutionIds.map((id) => ({
      queryKey: auditKeys.routes(id),
      queryFn: () => fetchRoutes(id),
    })),
  });

  const states = discoveries.data ?? [];
  const counts = discoveryCounts(states);
  const active = counts.queued + counts.running;
  // Sem descoberta ainda ou com a última falha: dá para pedir de novo, em lote.
  const pendingDiscovery = states
    .filter((s) => s.status === 'idle' || s.status === 'failed')
    .map((s) => s.institutionId);
  const discoverySummary =
    states.length === 0
      ? null
      : active > 0
        ? `Descoberta em segundo plano: ${counts.running} em andamento, ${counts.queued} na fila, ${counts.completed} ${counts.completed === 1 ? 'concluída' : 'concluídas'}. Dá para revisar as já descobertas ou sair desta tela; o progresso fica salvo.`
        : `Descoberta: ${counts.completed} ${counts.completed === 1 ? 'concluída' : 'concluídas'}${counts.failed > 0 ? `, ${counts.failed} com falha` : ''}${counts.idle > 0 ? `, ${counts.idle} não ${counts.idle === 1 ? 'feita' : 'feitas'}` : ''}.`;
  // O leitor de tela ouve as mudanças da fila, curtas, no máximo a cada 10 s.
  const announcement = useThrottledAnnouncement(
    active > 0
      ? `Descoberta: ${counts.running} em andamento, ${counts.queued} na fila, ${counts.completed} ${counts.completed === 1 ? 'concluída' : 'concluídas'}.`
      : '',
  );
  // O botão do lote some quando as instituições entram na fila: o foco vai para o resumo.
  const summaryRef = useRef<HTMLParagraphElement>(null);

  return (
    <Page>
      <PageHeader
        title="Revisão de rotas"
        breadcrumb={<Stepper current={1} />}
        description={`Para cada instituição, confirme a URL de cada página avaliada ou marque que o portal não tem a página (isso entra na cobertura): ${scope.functions
          .map((f) => pageFunctionLabels[f])
          .join(', ')}.`}
      />
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {discoverySummary ? (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-surface p-5 shadow-card">
          <p ref={summaryRef} tabIndex={-1} className="min-w-0 flex-1 basis-64 text-body text-text">
            {discoverySummary}
          </p>
          {pendingDiscovery.length > 0 ? (
            <Button
              variant="secondary"
              disabled={startDiscoveries.isPending}
              onClick={() =>
                startDiscoveries.mutate(pendingDiscovery, {
                  onSuccess: () => requestAnimationFrame(() => summaryRef.current?.focus()),
                })
              }
            >
              Descobrir rotas de {pendingDiscovery.length}{' '}
              {pendingDiscovery.length === 1 ? 'instituição' : 'instituições'}
            </Button>
          ) : null}
        </div>
      ) : null}
      {startDiscoveries.error ? (
        <p role="alert" className="text-label text-critical-text">
          {startDiscoveries.error instanceof ApiError
            ? startDiscoveries.error.message
            : 'Não foi possível pôr as descobertas na fila.'}
        </p>
      ) : null}

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
              discovery: states.find((s) => s.institutionId === id),
              confirmed,
              absent,
              reviewed: confirmed + absent,
              loading: routeQueries[index]?.isPending ?? true,
            };
          });
          const pending = rows.filter((r) => r.reviewed < scope.functions.length);
          const ready = rows.length > 0 && pending.length === 0 && rows.every((r) => !r.loading);

          const start = () =>
            startCollection.mutate(undefined, {
              onSuccess: ({ collection }) => void navigate(`/coletas/${collection.id}`),
            });

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
                    key: 'discovery',
                    header: 'Descoberta',
                    cell: (row) =>
                      row.discovery ? (
                        <span className="flex flex-col items-start gap-1">
                          <Badge
                            variant={
                              row.discovery.status === 'failed'
                                ? 'critical'
                                : isDiscoveryActive(row.discovery.status)
                                  ? 'moderate'
                                  : 'neutral'
                            }
                          >
                            {discoveryShortText(row.discovery)}
                          </Badge>
                          {row.discovery.status === 'failed' && row.discovery.error ? (
                            <span className="text-label text-text-muted">
                              {row.discovery.error}
                            </span>
                          ) : null}
                        </span>
                      ) : (
                        <span className="text-text-muted">Carregando…</span>
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
                        to={`/auditorias/nova/rotas/${row.id}`}
                        aria-label={`Revisar rotas do ${row.institution?.acronym ?? row.id}`}
                        className="text-accent-text underline underline-offset-2 hover:decoration-2"
                      >
                        Revisar rotas
                      </Link>
                    ),
                  },
                ]}
              />

              {startCollection.error ? (
                <div role="alert">
                  <ErrorState
                    title="Não foi possível iniciar a coleta"
                    description={
                      startCollection.error instanceof ApiError
                        ? startCollection.error.message
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
                <Button onClick={start} disabled={!ready || startCollection.isPending}>
                  {startCollection.isPending ? 'Iniciando…' : 'Iniciar coleta'}
                </Button>
                <ButtonLink to="/auditorias/nova/escopo" variant="secondary">
                  Voltar ao escopo
                </ButtonLink>
              </div>

              <DiscardDraft onDiscarded={() => void navigate('/auditorias/nova')} />
            </>
          );
        }}
      </QueryState>
    </Page>
  );
}
