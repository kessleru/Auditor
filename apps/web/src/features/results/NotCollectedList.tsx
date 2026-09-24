/**
 * Instituições cadastradas que ainda não passaram por coleta, numa linha recolhida: numa tabela,
 * dezenas de linhas "Ainda não avaliado" esconderiam as poucas que têm resultado.
 */
export function NotCollectedList({ rows }: { rows: { id: number; acronym: string }[] }) {
  if (rows.length === 0) return null;
  return (
    <details className="rounded-lg bg-surface shadow-card">
      <summary className="cursor-pointer p-5 text-body text-text">
        {rows.length === 1
          ? '1 instituição ainda não avaliada'
          : `${rows.length} instituições ainda não avaliadas`}
      </summary>
      <p className="px-5 pb-5 text-label text-text-muted">
        {rows.map((row) => row.acronym).join(', ')}.
      </p>
    </details>
  );
}
