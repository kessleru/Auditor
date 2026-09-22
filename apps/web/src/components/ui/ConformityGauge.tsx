import { classifyConformity } from '@auditoria-rf/contracts';
import { cn } from './cn';
import { conformityLabels, formatPercent } from './format';

const ringColor = {
  good: 'stroke-ok',
  partial: 'stroke-warn',
  critical: 'stroke-critical',
} as const;
const textColor = {
  good: 'text-ok-text',
  partial: 'text-warn-text',
  critical: 'text-critical-text',
} as const;

/**
 * Medidor circular de conformidade (à maneira do Lighthouse): número no centro, classificação em texto
 * logo abaixo, cor nunca sozinha. Continua sendo `role="meter"` com valor e texto acessíveis.
 */
export function ConformityGauge({
  value,
  label,
  size = 112,
}: {
  value: number;
  label: string;
  size?: number;
}) {
  const level = classifyConformity(value);
  const percent = Math.round(value * 100);
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={`${formatPercent(value)}, ${conformityLabels[level]}`}
        className="relative"
        style={{ width: size, height: size }}
      >
        <svg
          viewBox="0 0 100 100"
          className="size-full -rotate-90"
          aria-hidden="true"
          focusable="false"
        >
          <circle cx="50" cy="50" r={radius} fill="none" strokeWidth="8" className="stroke-muted" />
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${(circumference * percent) / 100} ${circumference}`}
            className={cn(ringColor[level], 'forced-colors:stroke-[CanvasText]')}
          />
        </svg>
        <span
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center text-metric text-text tabular-nums"
        >
          {percent}
          <span className="text-card">%</span>
        </span>
      </div>
      <span aria-hidden="true" className={cn('text-label font-medium', textColor[level])}>
        {conformityLabels[level]}
      </span>
    </div>
  );
}
