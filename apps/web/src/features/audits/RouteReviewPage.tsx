import {
  type PageFunctionKey,
  pageFunctionLabels,
  type RouteReplacement,
} from '@auditoria-rf/contracts';
import { type ReactNode, useId } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import {
  Button,
  ButtonLink,
  EmptyState,
  ErrorState,
  PageTitle,
  Stepper,
} from '../../components/ui';
import { ApiError } from '../../lib/api';
import { QueryState } from '../results/QueryState';
import {
  useDiscovery,
  useInstitutions,
  useReplaceRoute,
  useRoutes,
  useStartDiscovery,
} from './api';
import { DiscoveredRoutes } from './DiscoveredRoutes';
import { FunctionReviewItem } from './FunctionReviewItem';
import { displayUrl } from './routeLabels';
import { parseScope, scopeSearch } from './scope';

const errorMessage = (error: unknown) =>
  error instanceof ApiError
    ? error.message
    : 'Não foi possível concluir. Tente de novo em instantes.';

function Replacements({
  items,
  institutionId,
}: {
  items: RouteReplacement[];
  institutionId: number;
}) {
  const replace = useReplaceRoute(institutionId);
  if (items.length === 0) return null;
  return (
    <section
      aria-labelledby="substituicoes"
      className="flex flex-col gap-3 rounded-lg border border-border bg-warn-soft p-5"
    >
      <h2 id="substituicoes" className="text-card text-warn-text">
        Possíveis substituições de rota
      </h2>
      <p className="text-body text-text">
        Estas rotas confirmadas mudaram desde a última revisão. A troca só acontece com a sua
        confirmação; a rota antiga fica registrada e o histórico da função continua.
      </p>
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li key={item.routeId} className="flex flex-col gap-2 rounded-md bg-surface p-4">
            <p className="text-body">
              <span className="font-medium">
                {item.functionKey ? pageFunctionLabels[item.functionKey] : 'Rota'}
              </span>
              : <span className="font-mono text-code break-all">{displayUrl(item.url)}</span>{' '}
              {item.reason === 'moved'
                ? `mudou de endereço (HTTP ${item.httpStatus}).`
                : `não responde mais (HTTP ${item.httpStatus}).`}
            </p>
            {item.candidateRouteId !== null && item.candidateUrl ? (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-body">
                  Nova URL sugerida:{' '}
                  <span className="font-mono text-code break-all">
                    {displayUrl(item.candidateUrl)}
                  </span>
                </p>
                <Button
                  className="min-h-8 px-3"
                  disabled={replace.isPending}
                  onClick={() =>
                    replace.mutate({
                      routeId: item.routeId,
                      newRouteId: item.candidateRouteId as number,
                    })
                  }
                  aria-label={`Confirmar substituição de ${displayUrl(item.url)} por ${displayUrl(item.candidateUrl)}`}
                >
                  Confirmar substituição
                </Button>
              </div>
            ) : (
              <p className="text-body text-text-muted">
                Nenhuma candidata encontrada: escolha outra URL para a função na tabela abaixo.
              </p>
            )}
          </li>
        ))}
      </ul>
      {replace.error ? (
        <p role="alert" className="text-label text-critical-text">
          {errorMessage(replace.error)}
        </p>
      ) : null}
    </section>
  );
}

/** Grupo de funções ("Para revisar" ou "Revisadas"), numa lista com divisórias. */
function FunctionGroup({
  title,
  functions,
  children,
}: {
  title: string;
  functions: PageFunctionKey[];
  children: (key: PageFunctionKey) => ReactNode;
}) {
  const headingId = useId();
  if (functions.length === 0) return null;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2 id={headingId} className="text-section text-text">
        {title} ({functions.length})
      </h2>
      <ul className="flex flex-col divide-y divide-border rounded-lg bg-surface shadow-card">
        {functions.map((key) => children(key))}
      </ul>
    </section>
  );
}

/** Tela 1.2: revisão das rotas de uma instituição, uma função por linha. */
export function RouteReviewPage() {
  const params = useParams();
  const institutionId = Number(params.institutionId);
  const [searchParams] = useSearchParams();
  const scope = parseScope(searchParams);
  const functions =
    scope.functions.length > 0
      ? scope.functions
      : (Object.keys(pageFunctionLabels) as PageFunctionKey[]);
  const search = scopeSearch({ ...scope, functions });
  const institutions = useInstitutions();
  const routes = useRoutes(institutionId);
  const discovery = useDiscovery(institutionId);
  const start = useStartDiscovery(institutionId);
  const institution = institutions.data?.find((i) => i.id === institutionId);
  const acronym = institution?.acronym ?? '';
  const position = scope.institutionIds.indexOf(institutionId);
  const nextId = position >= 0 ? scope.institutionIds[position + 1] : undefined;
  const nextAcronym = institutions.data?.find((i) => i.id === nextId)?.acronym;
  const running = discovery.data?.status === 'running';
  const summary = discovery.data?.summary;

  const discoveryText = running
    ? 'Descobrindo rotas… Há um intervalo de 1,5 s entre requisições; pode levar alguns minutos.'
    : summary
      ? `Última descoberta: ${summary.found} URLs, ${summary.withSuggestion} com função sugerida.${
          summary.stoppedEarly === 'failures'
            ? ' Parou antes do fim: o portal deixou de responder.'
            : summary.stoppedEarly === 'deadline'
              ? ' Parou no tempo máximo.'
              : ''
        }`
      : null;

  return (
    <div className="flex flex-col gap-6">
      <Stepper current={1} />
      <nav aria-label="Trilha de navegação">
        <ol className="flex flex-wrap items-center gap-2 text-label">
          <li>
            <Link
              to={`/auditorias/nova${search}`}
              className="text-accent-text underline underline-offset-2 hover:decoration-2"
            >
              Nova auditoria
            </Link>
          </li>
          <li aria-hidden="true" className="text-text-muted">
            ›
          </li>
          <li>
            <Link
              to={`/auditorias/nova/rotas${search}`}
              className="text-accent-text underline underline-offset-2 hover:decoration-2"
            >
              Revisão de rotas
            </Link>
          </li>
          <li aria-hidden="true" className="text-text-muted">
            ›
          </li>
          <li aria-current="page">{acronym}</li>
        </ol>
      </nav>

      <div className="flex flex-col gap-1">
        <PageTitle
          documentTitle={`Revisão de rotas — ${acronym}`}
        >{`Revisão de rotas — ${acronym}`}</PageTitle>
        <p className="text-body text-text-muted">
          Confirme a página de cada função em {institution?.domain ?? 'portal'} ou registre que o
          portal não a tem. A descoberta só sugere; quem decide é você.
        </p>
      </div>

      {discovery.data?.status === 'failed' ? (
        <div role="alert">
          <ErrorState title="A descoberta falhou" description={discovery.data.error ?? undefined} />
        </div>
      ) : null}
      {start.error ? (
        <div role="alert">
          <ErrorState
            title="Não foi possível iniciar a descoberta"
            description={errorMessage(start.error)}
          />
        </div>
      ) : null}

      <Replacements items={discovery.data?.replacements ?? []} institutionId={institutionId} />

      <QueryState
        query={routes}
        loadingText="Carregando rotas…"
        errorTitle="Não foi possível carregar as rotas"
      >
        {({ routes: list, absences }) => {
          const authenticated = list.filter((r) => r.status === 'authenticated');
          const isReviewed = (key: PageFunctionKey) =>
            list.some((r) => r.status === 'confirmed' && r.functionKey === key) ||
            absences.some((a) => a.functionKey === key);
          const toReview = functions.filter((key) => !isReviewed(key));
          const reviewed = functions.filter(isReviewed);
          const item = (key: PageFunctionKey) => (
            <FunctionReviewItem
              key={key}
              functionKey={key}
              routes={list}
              absence={absences.find((a) => a.functionKey === key)}
              institutionId={institutionId}
            />
          );

          if (list.length === 0 && absences.length === 0 && !running) {
            return (
              <EmptyState
                title="Nenhuma rota descoberta ainda"
                description="A descoberta lê o robots.txt, o sitemap e o menu da página inicial e sugere a página de cada função."
                action={
                  <Button onClick={() => start.mutate()} disabled={start.isPending}>
                    Descobrir rotas
                  </Button>
                }
              />
            );
          }

          return (
            <>
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-surface p-5 shadow-card">
                <div className="flex min-w-0 flex-1 basis-64 flex-col gap-2">
                  <p className="text-card text-text">
                    {reviewed.length} de {functions.length} funções revisadas
                  </p>
                  <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-accent motion-safe:transition-[width] motion-safe:duration-300"
                      style={{ width: `${(reviewed.length / functions.length) * 100}%` }}
                    />
                  </div>
                  {discoveryText ? (
                    <p className="text-label text-text-muted" aria-live="polite">
                      {discoveryText}
                    </p>
                  ) : null}
                </div>
                <Button
                  variant="secondary"
                  onClick={() => start.mutate()}
                  disabled={running || start.isPending}
                >
                  {running ? 'Descobrindo…' : 'Descobrir de novo'}
                </Button>
              </div>

              <FunctionGroup title="Para revisar" functions={toReview}>
                {item}
              </FunctionGroup>
              <FunctionGroup title="Revisadas" functions={reviewed}>
                {item}
              </FunctionGroup>

              <div className="flex flex-col gap-3">
                <DiscoveredRoutes
                  routes={list}
                  functions={functions}
                  institutionId={institutionId}
                />
                <details className="rounded-lg bg-surface shadow-card">
                  <summary className="cursor-pointer p-5 text-card text-text">
                    Áreas que exigem login ({authenticated.length})
                  </summary>
                  <div className="flex flex-col gap-2 px-5 pb-5">
                    <p className="text-body text-text-muted">
                      Ficam fora da coleta: a ferramenta avalia só a página pública de login.
                    </p>
                    {authenticated.length > 0 ? (
                      <ul className="flex flex-col gap-1">
                        {authenticated.map((r) => (
                          <li key={r.id} className="font-mono text-code break-all">
                            {displayUrl(r.url)}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </details>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {nextId !== undefined ? (
                  <ButtonLink to={`/auditorias/nova/rotas/${nextId}${search}`}>
                    Próxima instituição{nextAcronym ? `: ${nextAcronym}` : ''}
                  </ButtonLink>
                ) : (
                  <ButtonLink to={`/auditorias/nova/rotas${search}`}>
                    Voltar à visão geral
                  </ButtonLink>
                )}
                {toReview.length > 0 ? (
                  <p className="text-label text-text-muted">
                    Faltam {toReview.length} {toReview.length === 1 ? 'função' : 'funções'}; dá para
                    voltar depois.
                  </p>
                ) : null}
              </div>
            </>
          );
        }}
      </QueryState>
    </div>
  );
}
