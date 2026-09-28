import { type ReactNode, type RefObject, useEffect, useId, useRef, useState } from 'react';
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

/** O conteúdo passa da largura do contêiner (a tabela rola na horizontal)? */
function useOverflowsX(ref: RefObject<HTMLElement | null>) {
  const [overflows, setOverflows] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const check = () => setOverflows(el.scrollWidth > el.clientWidth);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return overflows;
}

/**
 * Tabela real (`<table>`, `<caption>`, `<th scope>`), nunca uma grade de divs. Em tela estreita,
 * a tabela que rola na horizontal vira uma região focável com o nome da legenda: sem isso, quem
 * usa teclado não consegue rolar uma tabela sem links (WCAG 2.1.1).
 */
export function DataTable<Row>({
  caption,
  captionHidden,
  columns,
  rows,
  rowKey,
}: DataTableProps<Row>) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const captionId = useId();
  const scrollable = useOverflowsX(wrapperRef);
  return (
    <div
      ref={wrapperRef}
      className="overflow-x-auto rounded-lg bg-surface shadow-card"
      {...(scrollable && {
        role: 'region',
        'aria-labelledby': captionId,
        tabIndex: 0,
      })}
    >
      <table className="w-full border-collapse text-left text-body">
        <caption
          id={captionId}
          className={cn('px-5 py-3 text-left text-card', captionHidden && 'sr-only')}
        >
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
            <tr
              key={rowKey(row)}
              className="border-t border-border transition-colors duration-150 hover:bg-canvas"
            >
              {columns.map((col) => {
                const Cell = col.rowHeader ? 'th' : 'td';
                return (
                  <Cell
                    key={col.key}
                    {...(col.rowHeader && { scope: 'row' })}
                    className={cn(
                      'px-5 py-3 align-middle font-normal',
                      col.align === 'end' && 'text-right tabular-nums',
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
