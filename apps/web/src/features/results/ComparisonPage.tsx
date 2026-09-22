import type { AuditorInstitution } from '@auditoria-rf/contracts';
import { Download } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import {
  Badge,
  buttonClasses,
  cn,
  ConformityBar,
  DataTable,
  EmptyState,
  Note,
  Page,
  PageHeader,
} from '../../components/ui';
import { formatDate, formatNumber } from '../../lib/format';
import { CSV_DICTIONARY_URL, CSV_URL, useResultsOverview } from './auditorApi';
import { inspectionBadge } from './inspectionBadge';
import { QueryState } from './QueryState';

type Sort = 'conformity' | 'problems';

function Toggle({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'min-h-10 rounded-md border px-4 text-label font-medium transition-colors duration-150',
        pressed
          ? 'border-accent bg-accent text-white'
          : 'border-border-strong bg-surface text-text hover:bg-muted',
      )}
    >
      {children}
    </button>
  );
}

const rank = { evaluated: 0, no_data: 1, not_collected: 2 } as const;

/** Tela 4.2: comparativo entre instituições (visão do auditor). */
export function ComparisonPage() {
  const overview = useResultsOverview();
  const [sort, setSort] = useState<Sort>('conformity');
  const [onlyInspected, setOnlyInspected] = useState(false);
  const [onlyCritical, setOnlyCritical] = useState(false);

  return (
    <QueryState
      query={overview}
      loadingText="Carregando comparativo…"
      errorTitle="Não foi possível carregar o comparativo"
    >
      {(data) => {
        const rows = data.institutions
          .filter(
            (r) => !onlyInspected || (r.inspection !== null && r.inspection !== 'not_in_sample'),
          )
          .filter((r) => !onlyCritical || r.classification === 'critical')
          .sort(
            (a: AuditorInstitution, b: AuditorInstitution) =>
              rank[a.status] - rank[b.status] ||
              (sort === 'conformity'
                ? (b.conformity ?? -1) - (a.conformity ?? -1)
                : (a.problems ?? Infinity) - (b.problems ?? Infinity)) ||
              a.acronym.localeCompare(b.acronym),
          );
        return (
          <Page>
            <PageHeader
              title="Comparativo entre instituições"
              description="A métrica principal é o número de problemas distintos; ocorrências ficam no relatório de cada portal."
              meta={[
                {
                  label: 'Última coleta',
                  value: data.lastCollectionAt ? formatDate(data.lastCollectionAt) : '—',
                },
                {
                  label: 'Portais avaliados',
                  value: `${data.institutionsEvaluated} de ${data.institutionsTotal}`,
                },
              ]}
              actions={
                <a href={CSV_URL} download className={buttonClasses('secondary')}>
                  <Download aria-hidden="true" size={16} strokeWidth={1.75} /> Exportar CSV
                </a>
              }
            />

            <div className="flex flex-col gap-4">
              <div role="group" aria-label="Ordenar e filtrar" className="flex flex-wrap gap-2">
                <Toggle pressed={sort === 'conformity'} onClick={() => setSort('conformity')}>
                  Ordenar por conformidade
                </Toggle>
                <Toggle pressed={sort === 'problems'} onClick={() => setSort('problems')}>
                  Ordenar por nº de problemas
                </Toggle>
                <Toggle pressed={onlyInspected} onClick={() => setOnlyInspected((v) => !v)}>
                  Somente com inspeção manual
                </Toggle>
                <Toggle pressed={onlyCritical} onClick={() => setOnlyCritical((v) => !v)}>
                  Somente críticos
                </Toggle>
              </div>
              <p role="status" className="sr-only">
                {rows.length === 1
                  ? '1 instituição exibida'
                  : `${rows.length} instituições exibidas`}
              </p>

              {rows.length === 0 ? (
                <EmptyState title="Nenhuma instituição com esses filtros" />
              ) : (
                <DataTable
                  caption="Comparativo entre instituições"
                  captionHidden
                  rows={rows}
                  rowKey={(r) => r.id}
                  columns={[
                    {
                      key: 'inst',
                      header: 'Instituição',
                      rowHeader: true,
                      cell: (r) =>
                        r.status === 'evaluated' ? (
                          <Link
                            to={`/painel/instituicoes/${r.id}`}
                            aria-label={`Abrir relatório do ${r.acronym}`}
                            className="font-medium text-accent-text underline-offset-2 hover:underline"
                          >
                            {r.acronym}
                          </Link>
                        ) : (
                          <span className="text-text-muted">{r.acronym}</span>
                        ),
                    },
                    {
                      key: 'conf',
                      header: 'Conformidade',
                      cell: (r) =>
                        r.status === 'evaluated' ? (
                          <ConformityBar
                            value={r.conformity}
                            label={`Conformidade do ${r.acronym}`}
                          />
                        ) : (
                          <span className="text-label text-text-muted">
                            {r.status === 'no_data'
                              ? 'Portal não pôde ser avaliado na coleta'
                              : 'Ainda não avaliado'}
                          </span>
                        ),
                    },
                    {
                      key: 'prob',
                      header: 'Problemas',
                      align: 'end',
                      cell: (r) => (r.problems === null ? '—' : formatNumber(r.problems)),
                    },
                    {
                      key: 'crit',
                      header: 'Críticos',
                      align: 'end',
                      cell: (r) =>
                        r.criticalProblems === null ? '—' : formatNumber(r.criticalProblems),
                    },
                    {
                      key: 'insp',
                      header: 'Inspeção',
                      align: 'end',
                      cell: (r) => {
                        const b = inspectionBadge(r);
                        return <Badge variant={b.variant}>{b.label}</Badge>;
                      },
                    },
                  ]}
                />
              )}
            </div>

            <Note tone="surface" title="Como ler esta tabela">
              Problemas são distintos (o mesmo elemento com a mesma falha conta uma vez) e incluem
              os ainda não validados; falsos positivos ficam fora. Portais que não puderam ser
              auditados aparecem como ausência de dado e não entram na média. A conformidade indica
              apenas os critérios verificáveis automaticamente —{' '}
              <Link
                to="/metodologia"
                className="text-accent-text underline underline-offset-2 hover:decoration-2"
              >
                veja a metodologia
              </Link>
              . O CSV exportado traz os dados públicos (só achados confirmados);{' '}
              <a
                href={CSV_DICTIONARY_URL}
                download
                className="text-accent-text underline underline-offset-2 hover:decoration-2"
              >
                baixe o dicionário de dados
              </a>
              .
            </Note>
          </Page>
        );
      }}
    </QueryState>
  );
}
