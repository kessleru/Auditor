import type { ReactNode } from 'react';
import { cn } from './cn';

export type BadgeVariant =
  'critical' | 'moderate' | 'partial' | 'good' | 'automated' | 'inspection' | 'neutral';

const styles: Record<BadgeVariant, string> = {
  critical: 'bg-critical-soft text-critical-text',
  moderate: 'bg-warn-soft text-warn-text',
  partial: 'bg-warn-soft text-warn-text',
  good: 'bg-ok-soft text-ok-text',
  automated: 'bg-muted text-text',
  inspection: 'bg-accent-soft text-accent-text',
  neutral: 'bg-muted text-text-muted',
};

/** Selo: o texto é obrigatório; a cor nunca é a única informação (seção 4). */
export function Badge({ variant, children }: { variant: BadgeVariant; children: ReactNode }) {
  return (
    <span
      className={cn('inline-flex items-center rounded-sm px-2 py-1 text-badge', styles[variant])}
    >
      {children}
    </span>
  );
}
