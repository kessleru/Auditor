import { formatPercent } from '../../components/ui';
import { formatDate, formatMonth } from '../../lib/format';

export interface HistoryEntry {
  collectionId: number;
  collectedAt: string;
  conformity: number | null;
}

/**
 * Evolução da conformidade por coleta (uma série: sem legenda). Barras de até 24 px com topo
 * arredondado de 4 px saindo da linha de base; rótulo direto só na coleta mais recente; demais
 * valores no tooltip e na tabela equivalente, que garante acesso por teclado e leitor de tela.
 */
export function ConformityHistoryChart({
  entries,
  headingId,
}: {
  entries: HistoryEntry[];
  headingId: string;
}) {
  const last = entries.at(-1);
  // Uma coleta só não é evolução: diz o valor em texto e espera a próxima coleta para o gráfico.
  if (entries.length < 2 && last) {
    return (
      <p className="text-body text-text-muted">
        Primeira coleta em {formatDate(last.collectedAt)}:{' '}
        {last.conformity === null ? 'sem dado' : formatPercent(last.conformity)}. A evolução aparece
        a partir da segunda coleta.
      </p>
    );
  }
  const described = entries
    .map(
      (e) =>
        `${formatMonth(e.collectedAt)}: ${e.conformity === null ? 'sem dado' : formatPercent(e.conformity)}`,
    )
    .join('; ');

  return (
    <figure aria-labelledby={headingId} className="flex flex-col gap-4">
      <div
        role="img"
        aria-label={`Conformidade por coleta — ${described}`}
        className="relative h-44 pt-6"
      >
        <div className="absolute inset-x-0 bottom-6 h-px bg-border-strong" />
        <div className="relative flex h-full items-end gap-6 pl-1">
          {entries.map((entry) => {
            const isLast = entry === last;
            const value = entry.conformity;
            return (
              <div
                key={entry.collectionId}
                className="group relative flex h-full w-14 flex-col items-center justify-end gap-2"
              >
                {value === null ? (
                  <span className="mb-1 text-label text-text-muted">sem dado</span>
                ) : (
                  <>
                    {isLast ? (
                      <span className="text-label font-medium text-text">
                        {formatPercent(value)}
                      </span>
                    ) : null}
                    <div
                      className="w-6 rounded-t-[4px] bg-accent forced-colors:bg-[CanvasText]"
                      style={{ height: `calc((100% - 3rem) * ${value})` }}
                    />
                  </>
                )}
                <span className="h-4 text-label text-text-muted">
                  {formatMonth(entry.collectedAt)}
                </span>
                {value !== null ? (
                  <span className="pointer-events-none absolute -top-2 left-1/2 z-10 hidden -translate-x-1/2 rounded-md bg-text px-2 py-1 text-label whitespace-nowrap text-white shadow-float group-hover:block">
                    <strong className="font-medium">{formatPercent(value)}</strong> ·{' '}
                    {formatDate(entry.collectedAt)}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
      <details className="text-label">
        <summary className="inline-flex min-h-6 cursor-pointer items-center text-accent-text underline underline-offset-2 hover:decoration-2">
          Ver dados em tabela
        </summary>
        <table className="mt-3 w-full max-w-md border-collapse text-left text-body">
          <caption className="sr-only">Conformidade por coleta</caption>
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="py-2 pr-4 font-medium">
                Coleta
              </th>
              <th scope="col" className="py-2 font-medium">
                Conformidade
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.collectionId} className="border-b border-border">
                <th scope="row" className="py-2 pr-4 font-normal">
                  {formatDate(entry.collectedAt)}
                </th>
                <td className="py-2">
                  {entry.conformity === null ? 'Sem dado' : formatPercent(entry.conformity)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
