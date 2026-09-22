import type { ReactNode } from 'react';
import { cn } from './cn';

export interface Stat {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
}

/**
 * Indicadores numa faixa só, separados por divisórias (em vez de um cartão por número): lê-se como
 * um conjunto, e o rótulo vem antes do valor para o leitor de tela anunciar o contexto primeiro.
 */
export function StatGroup({
  stats,
  label,
  className,
}: {
  stats: Stat[];
  label: string;
  className?: string;
}) {
  return (
    <dl
      aria-label={label}
      className={cn(
        'grid gap-px overflow-hidden rounded-lg bg-border shadow-card sm:grid-cols-2',
        stats.length >= 4 ? 'lg:grid-cols-4' : stats.length === 3 ? 'lg:grid-cols-3' : '',
        className,
      )}
    >
      {stats.map((stat) => (
        <div key={stat.label} className="flex flex-col gap-1 bg-surface px-5 py-4">
          <dt className="text-label text-text-muted">{stat.label}</dt>
          <dd className="text-metric text-text tabular-nums">{stat.value}</dd>
          {stat.hint ? <dd className="text-label text-text-muted">{stat.hint}</dd> : null}
        </div>
      ))}
    </dl>
  );
}

/** Mesma faixa em carregamento (altura conhecida). */
export function StatGroupSkeleton({
  count,
  hints = [],
  label,
}: {
  count: number;
  hints?: boolean[];
  label: string;
}) {
  return (
    <div className="flex flex-col">
      <p role="status" className="sr-only">
        {label}
      </p>
      <div
        aria-hidden="true"
        className={cn(
          'grid gap-px overflow-hidden rounded-lg bg-border shadow-card sm:grid-cols-2',
          count >= 4 ? 'lg:grid-cols-4' : count === 3 ? 'lg:grid-cols-3' : '',
        )}
      >
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="flex flex-col gap-1 bg-surface px-5 py-4">
            <span className="block h-[18px] w-24 rounded-sm bg-muted" />
            <span className="block h-9 w-16 rounded-sm bg-muted" />
            {hints[i] ? <span className="block h-[18px] w-32 rounded-sm bg-muted" /> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
