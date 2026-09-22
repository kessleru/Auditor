import type { PublicInstitution } from '@auditoria-rf/contracts';
import { Link } from 'react-router';
import { ConformityBar, DataTable } from '../../components/ui';
import { formatNumber } from '../../lib/format';

function Problems({ row }: { row: PublicInstitution }) {
  if (row.problems === null) return <span className="text-text-muted">—</span>;
  return (
    <span className="flex flex-col items-end">
      <span>{formatNumber(row.problems)}</span>
      {row.pendingValidation > 0 ? (
        <span className="text-label text-text-muted">validação em andamento</span>
      ) : null}
    </span>
  );
}

function Conformity({ row }: { row: PublicInstitution }) {
  if (row.status === 'not_collected')
    return <span className="text-label text-text-muted">Ainda não avaliado</span>;
  return <ConformityBar value={row.conformity} label={`Conformidade do ${row.acronym}`} />;
}

/** Tabela pública de instituições (telas 0.2 e /instituicoes). Um link por linha. */
export function InstitutionsTable({
  rows,
  caption,
}: {
  rows: PublicInstitution[];
  caption: string;
}) {
  return (
    <DataTable
      caption={caption}
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
              <span className="font-medium text-text">{row.acronym}</span>
              <span className="text-label text-text-muted">{row.name}</span>
            </span>
          ),
        },
        { key: 'conformity', header: 'Conformidade', cell: (row) => <Conformity row={row} /> },
        {
          key: 'problems',
          header: 'Problemas confirmados',
          align: 'end',
          cell: (row) => <Problems row={row} />,
        },
        {
          key: 'report',
          header: 'Relatório',
          align: 'end',
          cell: (row) => (
            <Link
              to={`/instituicoes/${row.id}`}
              aria-label={`Abrir relatório do ${row.acronym}`}
              className="inline-flex min-h-6 items-center text-accent underline underline-offset-2 hover:text-accent-text"
            >
              Abrir
            </Link>
          ),
        },
      ]}
    />
  );
}
