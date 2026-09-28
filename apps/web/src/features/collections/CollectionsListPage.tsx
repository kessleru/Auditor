import type { CollectionStatus } from '@auditoria-rf/contracts';
import { Link } from 'react-router';
import {
  Badge,
  type BadgeVariant,
  ButtonLink,
  DataTable,
  EmptyState,
  Page,
  PageHeader,
} from '../../components/ui';
import { formatDate } from '../../lib/format';
import { QueryState } from '../results/QueryState';
import { useCollections } from './api';

const statusBadge: Record<CollectionStatus, { label: string; variant: BadgeVariant }> = {
  queued: { label: 'Na fila', variant: 'neutral' },
  running: { label: 'Em execução', variant: 'inspection' },
  completed: { label: 'Concluída', variant: 'good' },
  partial: { label: 'Parcial', variant: 'moderate' },
  cancelled: { label: 'Cancelada', variant: 'neutral' },
};

/** "Em andamento" e "Histórico" do auditor: mesma lista, filtros diferentes. */
export function CollectionsListPage({
  title,
  description,
  statuses,
  emptyText,
}: {
  title: string;
  description?: string;
  statuses: readonly CollectionStatus[];
  emptyText: string;
}) {
  const collections = useCollections(statuses);
  return (
    <Page>
      <PageHeader
        title={title}
        description={description}
        actions={
          <ButtonLink to="/auditorias/nova" variant="secondary">
            Nova auditoria
          </ButtonLink>
        }
      />
      <QueryState
        query={collections}
        loadingText="Carregando coletas…"
        errorTitle="Não foi possível carregar as coletas"
      >
        {(rows) =>
          rows.length === 0 ? (
            <EmptyState
              title={emptyText}
              action={<ButtonLink to="/auditorias/nova">Nova auditoria</ButtonLink>}
            />
          ) : (
            <DataTable
              caption={title}
              captionHidden
              rows={rows}
              rowKey={(row) => row.id}
              columns={[
                {
                  key: 'id',
                  header: 'Coleta',
                  rowHeader: true,
                  cell: (row) => (
                    <Link
                      to={`/coletas/${row.id}`}
                      className="font-medium text-accent-text underline-offset-2 hover:underline"
                    >
                      Coleta #{row.id}
                    </Link>
                  ),
                },
                { key: 'date', header: 'Criada em', cell: (row) => formatDate(row.createdAt) },
                {
                  key: 'institutions',
                  header: 'Instituições',
                  cell: (row) => row.institutions.map((i) => i.acronym).join(', '),
                },
                { key: 'author', header: 'Autor', cell: (row) => row.createdByName },
                {
                  key: 'progress',
                  header: 'Páginas',
                  align: 'end',
                  cell: (row) =>
                    `${row.progress.done + row.progress.failed} de ${row.progress.total}`,
                },
                {
                  key: 'status',
                  header: 'Situação',
                  cell: (row) => (
                    <Badge variant={statusBadge[row.status].variant}>
                      {statusBadge[row.status].label}
                    </Badge>
                  ),
                },
              ]}
            />
          )
        }
      </QueryState>
    </Page>
  );
}
