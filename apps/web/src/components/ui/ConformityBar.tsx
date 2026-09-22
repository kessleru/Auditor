import { classifyConformity } from '@auditoria-rf/contracts';
import { cn } from './cn';
import { conformityLabels, formatPercent } from './format';

const barColor = { good: 'bg-ok', partial: 'bg-warn', critical: 'bg-critical' } as const;

export interface ConformityBarProps {
  /** Fração de 0 a 1; `null` = ausência de dado (portal que falhou). */
  value: number | null;
  /** Nome acessível do medidor, ex.: "Conformidade do IFTM". */
  label: string;
  className?: string;
}

/** Barra de conformidade: sempre com percentual e classificação em texto ao lado. */
export function ConformityBar({ value, label, className }: ConformityBarProps) {
  if (value === null) {
    return <span className={cn('text-label text-text-muted', className)}>Sem dado</span>;
  }
  const level = classifyConformity(value);
  const percent = Math.round(value * 100);

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={`${formatPercent(value)}, ${conformityLabels[level]}`}
        className="h-2 w-32 shrink-0 overflow-hidden rounded-full bg-muted forced-colors:border forced-colors:border-[CanvasText]"
      >
        {/* No modo de alto contraste as cores de fundo somem; a barra usa a cor do sistema. */}
        <div
          className={cn(
            'h-full origin-left rounded-full forced-colors:bg-[CanvasText] motion-safe:animate-grow',
            barColor[level],
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
      {/* O medidor já anuncia percentual e classificação; o texto visível repete para quem enxerga. */}
      <span className="text-label whitespace-nowrap" aria-hidden="true">
        <span className="font-medium text-text">{formatPercent(value)}</span>{' '}
        <span className="text-text-muted">{conformityLabels[level]}</span>
      </span>
    </div>
  );
}
