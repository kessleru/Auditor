import type { CollectionPage as CollectedPage } from '@auditoria-rf/contracts';
import { RefreshCw } from 'lucide-react';
import { useId, useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  Badge,
  type BadgeVariant,
  Button,
  ButtonLink,
  ErrorState,
  Note,
  Page,
  PageHeader,
  Stepper,
} from '../../components/ui';
import { ApiError } from '../../lib/api';
import { useThrottledAnnouncement } from '../../lib/useThrottledAnnouncement';
import { QueryState } from '../results/QueryState';
import {
  FINISHED_STATUSES,
  useCancelCollection,
  useCollection,
  useCollectionEvents,
  useRetryPage,
} from './api';
import { describeFailure } from './failures';

const timeFormat = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Sao_Paulo',
});

function institutionStatus(pages: CollectedPage[]): {
  label: string;
  variant: BadgeVariant;
} {
  const done = pages.filter((p) => p.status === 'done');
  const failed = pages.filter((p) => p.status === 'failed');
  if (pages.some((p) => p.status === 'running'))
    return { label: 'Em análise', variant: 'inspection' };
  if (pages.every((p) => p.status === 'queued')) return { label: 'Na fila', variant: 'neutral' };
  if (pages.some((p) => p.status === 'queued'))
    return {
      label: `${done.length + failed.length} de ${pages.length} páginas`,
      variant: 'inspection',
    };
  if (done.length === 0) return { label: 'Falhou — sem dado', variant: 'critical' };
  const violated = done.reduce((sum, p) => sum + p.violationsCount, 0);
  const suffix = failed.length > 0 ? ` · ${failed.length} falha(s)` : '';
  return {
    label: `Concluído — ${violated} regra(s) violada(s)${suffix}`,
    variant: failed.length > 0 ? 'moderate' : 'good',
  };
}

function remainingText(startedAt: string | null, finished: number, total: number): string | null {
  if (!startedAt || finished === 0 || finished >= total) return null;
  const elapsed = Date.now() - new Date(startedAt).getTime();
  const minutes = Math.max(1, Math.round(((elapsed / finished) * (total - finished)) / 60_000));
  return `tempo estimado restante: ${minutes === 1 ? 'cerca de 1 minuto' : `cerca de ${minutes} minutos`}`;
}

/** Telas 2.1 (execução) e 2.2 (falha parcial). */
export function CollectionPage() {
  const id = Number(useParams().id);
  const [polling, setPolling] = useState(false);
  const detail = useCollection(id, { polling });
  const finished = detail.data ? FINISHED_STATUSES.includes(detail.data.collection.status) : false;
  const events = useCollectionEvents(id, Boolean(detail.data) && !finished);
  if (events.polling !== polling) setPolling(events.polling);

  const cancel = useCancelCollection(id);
  const retry = useRetryPage(id);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const failuresId = useId();

  const progress = detail.data?.collection.progress;
  const doneCount = progress ? progress.done + progress.failed : 0;
  const status = detail.data?.collection.status;
  const liveMessage = !progress
    ? ''
    : status === 'cancelled'
      ? 'Coleta cancelada.'
      : finished
        ? `Coleta concluída: ${progress.done} de ${progress.total} páginas avaliadas${progress.failed ? `, ${progress.failed} com falha` : ''}.`
        : `${doneCount} de ${progress.total} páginas concluídas.`;
  const announcement = useThrottledAnnouncement(liveMessage);

  return (
    <Page>
      {!finished ? <Stepper current={2} /> : null}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <QueryState
        query={detail}
        loadingText="Carregando coleta…"
        errorTitle="Não foi possível carregar a coleta"
      >
        {({ collection, institutions, pages }) => {
          const percent = collection.progress.total
            ? Math.round(
                ((collection.progress.done + collection.progress.failed) /
                  collection.progress.total) *
                  100,
              )
            : 0;
          const failures = pages.filter((p) => p.status === 'failed');
          const acronymOf = (institutionId: number) =>
            institutions.find((i) => i.id === institutionId)?.acronym ?? `#${institutionId}`;
          const title =
            collection.status === 'cancelled'
              ? `Coleta #${collection.id} cancelada`
              : finished
                ? `Coleta #${collection.id} concluída`
                : 'Auditoria em execução';
          const restante = finished
            ? null
            : remainingText(collection.startedAt, doneCount, collection.progress.total);
          const meta = [
            {
              label: 'Início',
              value: collection.startedAt
                ? timeFormat.format(new Date(collection.startedAt))
                : 'aguardando a vez na fila',
            },
            {
              label: 'Páginas concluídas',
              value: `${collection.progress.done + collection.progress.failed} de ${collection.progress.total}`,
            },
            ...(restante ? [{ label: 'Restante', value: restante }] : []),
          ];

          return (
            <>
              <PageHeader title={title} documentTitle={`Coleta #${collection.id}`} meta={meta} />

              {collection.status === 'queued' ? (
                <Note>
                  Outra coleta está usando um dos domínios deste escopo. Esta começa assim que ela
                  terminar — nunca há duas coletas no mesmo portal ao mesmo tempo.
                </Note>
              ) : null}

              <section className="flex flex-col gap-3 rounded-lg bg-surface p-5 shadow-card">
                <div className="flex items-center justify-between gap-4">
                  <h2 id="progresso" className="text-card text-text">
                    {finished ? 'Coleta dos portais' : 'Coletando dados dos portais'}
                  </h2>
                  <span className="text-card text-text" aria-hidden="true">
                    {percent}%
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-labelledby="progresso"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={percent}
                  aria-valuetext={`${percent}%: ${doneCount} de ${collection.progress.total} páginas`}
                  className="h-2 overflow-hidden rounded-full bg-muted forced-colors:border forced-colors:border-[CanvasText]"
                >
                  <div
                    className="h-full w-full origin-left rounded-full bg-accent forced-colors:bg-[CanvasText] motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out"
                    style={{ transform: `scaleX(${percent / 100})` }}
                  />
                </div>
                {!finished ? (
                  <p className="text-label text-text-muted">
                    Você pode sair desta tela: a coleta continua em segundo plano.
                    {polling ? ' Atualizando a cada 5 segundos.' : ''}
                  </p>
                ) : (
                  <p className="text-label text-text-muted">
                    axe-core {collection.axeVersion ?? '—'} · {collection.browserVersion ?? '—'}
                  </p>
                )}
              </section>

              <ul
                aria-label="Andamento por instituição"
                className="flex flex-col divide-y divide-border rounded-lg bg-surface shadow-card"
              >
                {institutions.map((institution) => {
                  const own = pages.filter((p) => p.institutionId === institution.id);
                  const badge = institutionStatus(own);
                  return (
                    <li
                      key={institution.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
                    >
                      <span className="flex flex-col">
                        <span className="font-medium text-text">{institution.acronym}</span>
                        <span className="text-label text-text-muted">{institution.name}</span>
                      </span>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </li>
                  );
                })}
              </ul>

              {failures.length > 0 ? (
                <section aria-labelledby={failuresId} className="flex flex-col gap-3">
                  <ErrorState
                    headingLevel={2}
                    title={
                      failures.length === 1
                        ? '1 página não pôde ser auditada'
                        : `${failures.length} páginas não puderam ser auditadas`
                    }
                    description="Ficam de fora dos indicadores desta coleta e são registradas como ausência de dado, não como conformidade zero — tratá-las como zero distorceria a média do estudo."
                  />
                  <h3 id={failuresId} className="sr-only">
                    Páginas com falha
                  </h3>
                  <ul className="flex flex-col divide-y divide-border rounded-lg bg-surface shadow-card">
                    {failures.map((page) => (
                      <li key={page.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                        <span className="min-w-24 font-medium">
                          {acronymOf(page.institutionId)}
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="text-body text-text">
                            {describeFailure(page.error, page.httpStatus)}
                          </span>
                          <span className="font-mono text-code break-all text-text-muted">
                            {page.url}
                          </span>
                        </span>
                        {collection.status !== 'cancelled' ? (
                          <Button
                            variant="secondary"
                            className="min-h-9"
                            disabled={retry.isPending}
                            onClick={() => retry.mutate(page.id)}
                            aria-label={`Tentar novamente ${page.url}`}
                          >
                            <RefreshCw aria-hidden="true" size={16} strokeWidth={1.75} />
                            Tentar novamente
                          </Button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                  {retry.error ? (
                    <p role="alert" className="text-label text-critical-text">
                      {retry.error instanceof ApiError
                        ? retry.error.message
                        : 'Não foi possível tentar de novo.'}
                    </p>
                  ) : null}
                </section>
              ) : null}

              {!finished ? (
                confirmingCancel ? (
                  <div
                    role="group"
                    aria-label="Confirmar cancelamento"
                    className="motion-safe:animate-enter flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface p-4"
                  >
                    <p className="text-body">
                      Cancelar a coleta? As páginas já avaliadas ficam registradas; as da fila não
                      serão auditadas.
                    </p>
                    <Button
                      onClick={() =>
                        cancel.mutate(undefined, { onSuccess: () => setConfirmingCancel(false) })
                      }
                      disabled={cancel.isPending}
                    >
                      Confirmar cancelamento
                    </Button>
                    <Button variant="secondary" onClick={() => setConfirmingCancel(false)}>
                      Continuar coletando
                    </Button>
                  </div>
                ) : (
                  <div>
                    <Button variant="secondary" onClick={() => setConfirmingCancel(true)}>
                      Cancelar auditoria
                    </Button>
                  </div>
                )
              ) : (
                <div className="flex flex-wrap gap-3">
                  <ButtonLink to={`/inspecao/${collection.id}`}>
                    Ir para a inspeção manual
                  </ButtonLink>
                  <ButtonLink to="/historico" variant="secondary">
                    Ver histórico de coletas
                  </ButtonLink>
                </div>
              )}

              <p className="text-label text-text-muted">
                A conformidade cobre apenas critérios verificáveis automaticamente —{' '}
                <Link
                  to="/metodologia"
                  className="text-accent-text underline underline-offset-2 hover:decoration-2"
                >
                  veja a metodologia
                </Link>
                .
              </p>
            </>
          );
        }}
      </QueryState>
    </Page>
  );
}
