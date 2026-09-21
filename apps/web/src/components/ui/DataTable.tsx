import type { ReactNode } from 'react';
import { cn } from './cn';

export interface Column<Row> {
  key: string;
  header: ReactNode;
  cell: (row: Row) => ReactNode;
  align?: 'start' | 'end';
  /** A coluna identifica a linha (`<th scope="row">`). */
  rowHeader?: boolean;
}

export interface DataTableProps<Row> {
  caption: string;
  /** Legenda visível ou só para leitor de tela. */
  captionHidden?: boolean;
  columns: Column<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string | number;
}

/** Tabela real (`<table>`, `<caption>`, `<th scope>`), nunca uma grade de divs. */
export function DataTable<Row>({
  caption,
  captionHidden,
  columns,
  rows,
  rowKey,
}: DataTableProps<Row>) {
  return (
    <div className="overflow-x-auto rounded-lg bg-surface shadow-card">
      <table className="w-full border-collapse text-left text-body">
        <caption className={cn('px-5 py-3 text-left text-card', captionHidden && 'sr-only')}>
          {caption}
        </caption>
        <thead className="bg-muted">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={cn(
                  'px-5 py-3 text-label font-medium text-text',
                  col.align === 'end' && 'text-right',
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="border-t border-border">
              {columns.map((col) => {
                const Cell = col.rowHeader ? 'th' : 'td';
                return (
                  <Cell
                    key={col.key}
                    {...(col.rowHeader && { scope: 'row' })}
                    className={cn(
                      'px-5 py-3 align-middle font-normal',
                      col.align === 'end' && 'text-right',
                    )}
                  >
                    {col.cell(row)}
                  </Cell>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
