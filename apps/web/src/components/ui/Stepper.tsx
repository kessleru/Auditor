import { Check } from 'lucide-react';
import { cn } from './cn';

export const auditSteps = ['Escopo', 'Revisão de rotas', 'Coleta'] as const;

/**
 * Indicador de etapa: etapa concluída diz "concluída" em texto; a atual tem `aria-current="step"`.
 * `current` começa em 0.
 */
export function Stepper({
  steps = auditSteps,
  current,
}: {
  steps?: readonly string[];
  current: number;
}) {
  return (
    <ol aria-label="Etapas da auditoria" className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {steps.map((step, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li
            key={step}
            aria-current={active ? 'step' : undefined}
            className="flex items-center gap-2 text-label"
          >
            {index > 0 ? (
              <span
                aria-hidden="true"
                className={cn(
                  'h-0.5 w-8 rounded-full',
                  done || active ? 'bg-ok' : 'bg-border-strong',
                )}
              />
            ) : null}
            <span
              aria-hidden="true"
              className={cn(
                'flex size-6 items-center justify-center rounded-full text-badge',
                done && 'bg-ok text-white',
                active && 'bg-accent text-white',
                !done && !active && 'border border-border-strong text-text-muted',
              )}
            >
              {done ? <Check size={14} strokeWidth={2.5} /> : index + 1}
            </span>
            <span className={cn(active ? 'font-medium text-text' : 'text-text-muted')}>
              {step}
              {done ? ' — concluída' : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
