import type { ReactNode } from 'react';

/** Indicador: rótulo antes do valor, para o leitor de tela anunciar o contexto primeiro. */
export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="rounded-lg bg-surface p-5 shadow-card">
      <dl className="flex flex-col gap-1">
        <dt className="text-label text-text-muted">{label}</dt>
        <dd className="text-metric text-text">{value}</dd>
      </dl>
      {hint ? <p className="mt-2 text-label text-text-muted">{hint}</p> : null}
    </div>
  );
}
