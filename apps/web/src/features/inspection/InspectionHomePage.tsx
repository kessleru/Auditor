import { Link } from 'react-router';
import { ButtonLink, DataTable, EmptyState, Page, PageHeader } from '../../components/ui';
import { formatDate } from '../../lib/format';
import { useCollections } from '../collections/api';
import { QueryState } from '../results/QueryState';

/** Entrada da inspeção manual: escolha da coleta terminada. */
export function InspectionHomePage() {
  const collections = useCollections(['completed', 'partial']);
  return (
    <Page>
      <PageHeader
        title="Inspeção manual"
        description="Escolha a coleta terminada cujos portais você vai inspecionar."
      />
      <QueryState
        query={collections}
        loadingText="Carregando coletas…"
        errorTitle="Não foi possível carregar as coletas"
      >
        {(rows) =>
          rows.length === 0 ? (
            <EmptyState
              title="Nenhuma coleta terminada"
              description="A inspeção manual começa depois que uma coleta automatizada termina."
              action={<ButtonLink to="/auditorias/nova">Nova auditoria</ButtonLink>}
            />
          ) : (
            <DataTable
              caption="Coletas disponíveis para inspeção"
              captionHidden
              rows={rows}
              rowKey={(r) => r.id}
              columns={[
                {
                  key: 'id',
                  header: 'Coleta',
                  rowHeader: true,
                  cell: (r) => (
                    <Link
                      to={`/inspecao/${r.id}`}
                      className="font-medium text-accent-text underline-offset-2 hover:underline"
                    >
                      Coleta #{r.id}
                    </Link>
                  ),
                },
                {
                  key: 'date',
                  header: 'Terminada em',
                  cell: (r) => (r.finishedAt ? formatDate(r.finishedAt) : '—'),
                },
                {
                  key: 'inst',
                  header: 'Instituições',
                  cell: (r) => r.institutions.map((i) => i.acronym).join(', '),
                },
              ]}
            />
          )
        }
      </QueryState>
    </Page>
  );
}
