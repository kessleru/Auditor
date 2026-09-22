import { Link } from 'react-router';
import { ConformityGauge } from '../../components/ui';
import { formatNumber } from '../../lib/format';

export interface SummaryFigure {
  label: string;
  value: number | string;
  hint?: string;
}

/**
 * Resumo da instituição: o medidor de conformidade é o destaque; os números ficam ao lado, menores.
 * O aviso de que a nota cobre só critérios automatizáveis fica junto do número, não em outra tela.
 */
export function ConformitySummary({
  conformity,
  acronym,
  figures,
}: {
  conformity: number | null;
  acronym: string;
  figures: SummaryFigure[];
}) {
  return (
    <section
      aria-label={`Resumo do ${acronym}`}
      className="grid items-center gap-6 rounded-lg bg-surface p-6 shadow-card sm:grid-cols-[auto_1fr] sm:gap-10"
    >
      <div className="flex flex-col items-center gap-3 sm:border-r sm:border-border sm:pr-10">
        {conformity === null ? (
          <p className="text-body text-text-muted">Sem regra aplicável</p>
        ) : (
          <ConformityGauge value={conformity} label={`Conformidade do ${acronym}`} />
        )}
        <Link
          to="/metodologia"
          className="text-label text-accent-text underline underline-offset-2 hover:decoration-2"
        >
          Só critérios automatizáveis
        </Link>
      </div>
      <dl className="grid grid-cols-2 gap-x-8 gap-y-5 lg:grid-cols-4">
        {figures.map((f) => (
          <div key={f.label} className="flex flex-col gap-1">
            <dt className="text-label text-text-muted">{f.label}</dt>
            <dd className="text-metric text-text tabular-nums">
              {typeof f.value === 'number' ? formatNumber(f.value) : f.value}
            </dd>
            {f.hint ? <dd className="text-label text-text-muted">{f.hint}</dd> : null}
          </div>
        ))}
      </dl>
    </section>
  );
}
