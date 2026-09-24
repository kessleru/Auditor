import {
  type PageFunctionKey,
  pageFunctionLabels,
  type Route,
  type RouteReplacement,
} from '@auditoria-rf/contracts';
import { type FormEvent, useId, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import {
  Badge,
  Button,
  ButtonLink,
  EmptyState,
  ErrorState,
  Note,
  PageTitle,
  Stepper,
  TextField,
} from '../../components/ui';
import { ApiError } from '../../lib/api';
import { QueryState } from '../results/QueryState';
import {
  useCreateRoute,
  useDiscovery,
  useInstitutions,
  useReplaceRoute,
  useRoutes,
  useStartDiscovery,
  useUpdateRoute,
} from './api';
import { byRelevance, candidatesFor, routeCaption } from './candidates';
import { DiscoveredRoutes } from './DiscoveredRoutes';
import { displayUrl, sourceLabels, statusBadges } from './routeLabels';
import { parseScope, scopeSearch } from './scope';

const errorMessage = (error: unknown) =>
  error instanceof ApiError
    ? error.message
    : 'Não foi possível concluir. Tente de novo em instantes.';

/** Linha da tabela: a rota confirmada da função, ou a melhor sugestão, e a escolha de outra URL. */
function FunctionRow({
  functionKey,
  routes,
  institutionId,
}: {
  functionKey: PageFunctionKey;
  routes: Route[];
  institutionId: number;
}) {
  const update = useUpdateRoute(institutionId);
  const [choosing, setChoosing] = useState(false);
  const [choice, setChoice] = useState<number | ''>('');
  const formId = useId();
  const label = pageFunctionLabels[functionKey];
  const confirmed = routes.find((r) => r.status === 'confirmed' && r.functionKey === functionKey);
  const candidates = candidatesFor(routes, functionKey);
  // A sugestão mostrada é a mais relevante; as demais ficam na lista de escolha, em ordem.
  const suggestion = confirmed ? undefined : candidates[0];
  const current = confirmed ?? suggestion;
  const others = routes
    .filter(
      (r) =>
        (r.status === 'suggested' || r.status === 'confirmed') &&
        !candidates.includes(r) &&
        r !== confirmed,
    )
    .sort(byRelevance);
  const caption = current ? routeCaption(current) : null;
  const moreCandidates = candidates.filter((r) => r !== suggestion).length;
  const optionText = (route: Route) => {
    const text = route.title ?? route.linkText;
    return `${displayUrl(route.url)}${text ? ` — ${text}` : ''}`;
  };

  const confirm = (routeId: number) =>
    update.mutate(
      { id: routeId, status: 'confirmed', functionKey, replaceConfirmed: true },
      { onSuccess: () => setChoosing(false) },
    );

  return (
    <tr className="border-t border-border align-top">
      <th scope="row" className="px-5 py-3 text-left font-normal">
        {label}
      </th>
      <td className="px-5 py-3">
        {current ? (
          <>
            <span className="font-mono text-code break-all">{displayUrl(current.url)}</span>
            {caption ? (
              <span className="mt-1 block text-label text-text-muted">{caption}</span>
            ) : null}
            {moreCandidates > 0 ? (
              <span className="mt-1 block text-label text-text-muted">
                {moreCandidates === 1
                  ? 'Mais 1 candidata em “Escolher outra”'
                  : `Mais ${moreCandidates} candidatas em “Escolher outra”`}
              </span>
            ) : null}
          </>
        ) : (
          <span className="text-text-muted">Nenhuma URL sugerida</span>
        )}
      </td>
      <td className="px-5 py-3">{current ? sourceLabels[current.source] : '—'}</td>
      <td className="px-5 py-3">
        {current ? (
          <Badge variant={statusBadges[current.status].variant}>
            {statusBadges[current.status].label}
          </Badge>
        ) : (
          <Badge variant="neutral">Sem rota</Badge>
        )}
      </td>
      <td className="px-5 py-3">
        <div className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap justify-end gap-2">
            {suggestion ? (
              <Button
                className="min-h-8 px-3"
                disabled={update.isPending}
                aria-label={`Confirmar ${displayUrl(suggestion.url)} para ${label}`}
                onClick={() => confirm(suggestion.id)}
              >
                Confirmar
              </Button>
            ) : null}
            <Button
              variant="secondary"
              className="min-h-8 px-3"
              aria-expanded={choosing}
              aria-controls={formId}
              aria-label={`${confirmed ? 'Trocar' : 'Escolher outra'} URL para ${label}`}
              onClick={() => setChoosing((c) => !c)}
            >
              {confirmed ? 'Trocar' : 'Escolher outra'}
            </Button>
          </div>
          <form
            id={formId}
            hidden={!choosing}
            className="motion-safe:animate-enter flex w-full max-w-md flex-col items-end gap-2"
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              if (choice !== '') confirm(choice);
            }}
          >
            <label className="flex w-full flex-col gap-1 text-left text-label font-medium">
              URL para {label}
              <select
                value={choice}
                onChange={(event) =>
                  setChoice(event.target.value === '' ? '' : Number(event.target.value))
                }
                className="min-h-10 w-full rounded-md border border-border-strong bg-surface px-2 font-normal"
              >
                <option value="">Escolha uma URL descoberta</option>
                {candidates.length > 0 ? (
                  <optgroup label={`Sugeridas para ${label}, da mais relevante`}>
                    {candidates.map((route) => (
                      <option key={route.id} value={route.id}>
                        {optionText(route)}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                {others.length > 0 ? (
                  <optgroup label="Outras URLs descobertas">
                    {others.map((route) => (
                      <option key={route.id} value={route.id}>
                        {optionText(route)}
                        {route.functionKey
                          ? ` (sugerida: ${pageFunctionLabels[route.functionKey]})`
                          : ''}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
              </select>
            </label>
            <Button
              type="submit"
              className="min-h-8 px-3"
              disabled={choice === '' || update.isPending}
            >
              Usar esta URL
            </Button>
          </form>
          {update.error ? (
            <p role="alert" className="text-label text-critical-text">
              {errorMessage(update.error)}
            </p>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

function RoutesTable({
  functions,
  routes,
  institutionId,
  acronym,
}: {
  functions: PageFunctionKey[];
  routes: Route[];
  institutionId: number;
  acronym: string;
}) {
  const headers = ['Função avaliada', 'URL correspondente', 'Origem', 'Situação', 'Ação'];
  return (
    <div className="overflow-x-auto rounded-lg bg-surface shadow-card">
      <table className="w-full border-collapse text-left text-body">
        <caption className="sr-only">Rotas por função avaliada — {acronym}</caption>
        <thead className="bg-muted">
          <tr>
            {headers.map((header, index) => (
              <th
                key={header}
                scope="col"
                className={`px-5 py-3 text-label font-medium ${index === headers.length - 1 ? 'text-right' : ''}`}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {functions.map((key) => (
            <FunctionRow
              key={key}
              functionKey={key}
              routes={routes}
              institutionId={institutionId}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

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

function ManualRouteForm({
  institutionId,
  functions,
}: {
  institutionId: number;
  functions: PageFunctionKey[];
}) {
  const create = useCreateRoute(institutionId);
  const [url, setUrl] = useState('');
  const [functionKey, setFunctionKey] = useState<PageFunctionKey>(functions[0] ?? 'home');
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-3 rounded-lg bg-surface p-5 shadow-card"
    >
      <h2 id={headingId} className="text-card text-text">
        Informar uma URL manualmente
      </h2>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          create.mutate(
            { url, functionKey, replaceConfirmed: true },
            { onSuccess: () => setUrl('') },
          );
        }}
      >
        <label className="flex flex-col gap-1.5 text-label font-medium">
          Função
          <select
            value={functionKey}
            onChange={(event) => setFunctionKey(event.target.value as PageFunctionKey)}
            className="min-h-10 rounded-md border border-border-strong bg-surface px-2 font-normal"
          >
            {functions.map((key) => (
              <option key={key} value={key}>
                {pageFunctionLabels[key]}
              </option>
            ))}
          </select>
        </label>
        <TextField
          label="URL"
          type="url"
          placeholder="https://www.iftm.edu.br/ingresso"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          className="min-w-64 flex-1"
          error={create.error ? errorMessage(create.error) : undefined}
        />
        <Button type="submit" disabled={url.trim() === '' || create.isPending}>
          Confirmar URL
        </Button>
      </form>
    </section>
  );
}

/** Tela 1.2: revisão das rotas de uma instituição. */
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
        <p className="text-label text-text-muted" aria-live="polite">
          {running
            ? `Descobrindo rotas em ${institution?.domain ?? ''}… respeitando 1,5 s entre requisições; pode levar alguns minutos.`
            : summary
              ? `${summary.found} URLs descobertas em ${institution?.domain ?? ''} (${summary.withSuggestion} com função sugerida), por ${
                  summary.source === 'sitemap'
                    ? `sitemap (${summary.sitemapFiles} arquivo(s)) e links da página inicial`
                    : 'rastreamento até 2 níveis'
                }. robots.txt ${summary.robotsTxtFound ? 'encontrado' : 'ausente'}.${
                  summary.stoppedEarly === 'failures'
                    ? ' A descoberta parou antes do fim: o portal deixou de responder (muitas falhas seguidas). Tente de novo mais tarde.'
                    : summary.stoppedEarly === 'deadline'
                      ? ' A descoberta parou no tempo máximo; as rotas encontradas até ali foram guardadas.'
                      : ''
                }`
              : institution?.domain}
        </p>
      </div>

      <Note title="Por que esta etapa é manual">
        A descoberta automática lista as URLs; a correspondência entre elas e as funções avaliadas é
        confirmada pelo pesquisador. Sem isso, a comparação entre instituições recairia sobre
        páginas de funções diferentes.
      </Note>

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
        {(list) => {
          const authenticated = list.filter((r) => r.status === 'authenticated');
          if (list.length === 0 && !running) {
            return (
              <EmptyState
                title="Nenhuma rota descoberta ainda"
                description="A descoberta lê o robots.txt e o sitemap do portal (ou percorre os links a partir da página inicial) e sugere a função de cada página."
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
              <RoutesTable
                functions={functions}
                routes={list}
                institutionId={institutionId}
                acronym={acronym}
              />

              <DiscoveredRoutes routes={list} functions={functions} institutionId={institutionId} />

              <ManualRouteForm institutionId={institutionId} functions={functions} />

              <details className="rounded-lg bg-surface p-5 shadow-card">
                <summary className="cursor-pointer text-card text-text">
                  Áreas que exigem autenticação ({authenticated.length})
                </summary>
                <p className="mt-3 text-body text-text-muted">
                  Ficam fora da coleta automatizada: a ferramenta avalia apenas a página pública de
                  login.
                </p>
                {authenticated.length > 0 ? (
                  <ul className="mt-2 flex flex-col gap-1">
                    {authenticated.map((r) => (
                      <li key={r.id} className="font-mono text-code break-all">
                        {displayUrl(r.url)}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </details>

              <div className="flex flex-wrap gap-3">
                <Button
                  variant="secondary"
                  onClick={() => start.mutate()}
                  disabled={running || start.isPending}
                >
                  {running ? 'Descobrindo…' : 'Descobrir novamente'}
                </Button>
                {nextId !== undefined ? (
                  <ButtonLink to={`/auditorias/nova/rotas/${nextId}${search}`}>
                    Próxima instituição{nextAcronym ? `: ${nextAcronym}` : ''}
                  </ButtonLink>
                ) : (
                  <ButtonLink to={`/auditorias/nova/rotas${search}`}>
                    Voltar à visão geral
                  </ButtonLink>
                )}
              </div>
            </>
          );
        }}
      </QueryState>
    </div>
  );
}
