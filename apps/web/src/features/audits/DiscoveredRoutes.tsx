import { type PageFunctionKey, pageFunctionLabels, type Route } from '@auditoria-rf/contracts';
import { useId, useState } from 'react';
import { Badge, Button, SearchField } from '../../components/ui';
import { ApiError } from '../../lib/api';
import { useUpdateRoute } from './api';
import { byRelevance, matchesQuery, relevanceBadge, routeCaption } from './candidates';
import { displayUrl, sourceLabels, statusBadges } from './routeLabels';

type FunctionFilter = PageFunctionKey | 'none' | '';

/**
 * Todas as URLs públicas descobertas no portal, da mais para a menos relevante, com filtro por
 * texto e por função sugerida. Serve para achar a página certa quando a sugestão principal erra,
 * sem precisar abrir o portal.
 */
export function DiscoveredRoutes({
  routes,
  functions,
  institutionId,
}: {
  routes: Route[];
  /** Funções do escopo: só para elas há o atalho "Usar como". */
  functions: PageFunctionKey[];
  institutionId: number;
}) {
  const update = useUpdateRoute(institutionId);
  const [query, setQuery] = useState('');
  const [fn, setFn] = useState<FunctionFilter>('');
  const filterId = useId();

  const all = routes.filter((r) => r.status !== 'authenticated').sort(byRelevance);
  const shown = all.filter(
    (r) =>
      matchesQuery(r, query) &&
      (fn === '' || (fn === 'none' ? r.functionKey === null : r.functionKey === fn)),
  );

  return (
    <details className="rounded-lg bg-surface shadow-card">
      <summary className="cursor-pointer p-5 text-card text-text">
        Todas as URLs descobertas ({all.length})
      </summary>
      <div className="flex flex-col gap-4 px-5 pb-5">
        <p className="text-body text-text-muted">
          Da mais para a menos relevante. A relevância só ordena; quem decide é você.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <SearchField
            label="Filtrar por endereço, título ou texto do link"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-w-64 flex-1"
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor={filterId} className="text-label font-medium text-text">
              Função sugerida
            </label>
            <select
              id={filterId}
              value={fn}
              onChange={(e) => setFn(e.target.value as FunctionFilter)}
              className="min-h-10 rounded-md border border-border-strong bg-surface px-2 text-body"
            >
              <option value="">Todas</option>
              {(Object.keys(pageFunctionLabels) as PageFunctionKey[]).map((key) => (
                <option key={key} value={key}>
                  {pageFunctionLabels[key]}
                </option>
              ))}
              <option value="none">Sem sugestão</option>
            </select>
          </div>
        </div>
        <p className="text-label text-text-muted" aria-live="polite">
          {shown.length === all.length
            ? `${all.length} URLs`
            : `${shown.length} de ${all.length} URLs`}
        </p>
        {update.error ? (
          <p role="alert" className="text-label text-critical-text">
            {update.error instanceof ApiError
              ? update.error.message
              : 'Não foi possível concluir. Tente de novo em instantes.'}
          </p>
        ) : null}
        {shown.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-body">
              <caption className="sr-only">URLs descobertas, por relevância</caption>
              <thead className="bg-muted">
                <tr>
                  {['URL', 'Sugestão', 'Situação', 'Ação'].map((header, index) => (
                    <th
                      key={header}
                      scope="col"
                      className={`px-4 py-3 text-label font-medium ${index === 3 ? 'text-right' : ''}`}
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((route) => {
                  const relevance = relevanceBadge(route.relevance);
                  const caption = routeCaption(route);
                  const usable =
                    route.status === 'suggested' &&
                    route.functionKey !== null &&
                    functions.includes(route.functionKey);
                  return (
                    <tr key={route.id} className="border-t border-border align-top">
                      <th scope="row" className="px-4 py-3 text-left font-normal">
                        <a
                          href={route.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-code break-all text-accent-text underline underline-offset-2 hover:decoration-2"
                          aria-label={`${displayUrl(route.url)} (abre em nova aba)`}
                        >
                          {displayUrl(route.url)}
                        </a>
                        <span className="mt-1 block text-label text-text-muted">
                          {caption ? `${caption} · ` : ''}via {sourceLabels[route.source]}
                        </span>
                      </th>
                      <td className="px-4 py-3">
                        {route.functionKey ? (
                          <span className="flex flex-col items-start gap-1">
                            {pageFunctionLabels[route.functionKey]}
                            {relevance ? (
                              <Badge variant={relevance.variant}>
                                {relevance.label} ({route.relevance})
                              </Badge>
                            ) : null}
                          </span>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusBadges[route.status].variant}>
                          {statusBadges[route.status].label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {usable && route.functionKey ? (
                          <Button
                            variant="secondary"
                            className="min-h-8 px-3"
                            disabled={update.isPending}
                            aria-label={`Usar ${displayUrl(route.url)} como ${pageFunctionLabels[route.functionKey]}`}
                            onClick={() =>
                              update.mutate({
                                id: route.id,
                                status: 'confirmed',
                                functionKey: route.functionKey as PageFunctionKey,
                                replaceConfirmed: true,
                              })
                            }
                          >
                            Usar como {pageFunctionLabels[route.functionKey]}
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-body text-text-muted">Nenhuma URL com esse filtro.</p>
        )}
      </div>
    </details>
  );
}
