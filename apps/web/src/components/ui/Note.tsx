import { Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from './cn';

/** Nota informativa: ícone decorativo, texto sempre presente. */
export function Note({
  title,
  children,
  tone = 'accent',
  className,
}: {
  title?: string;
  children: ReactNode;
  tone?: 'accent' | 'surface';
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex gap-3 rounded-lg px-5 py-4 text-body',
        tone === 'accent'
          ? 'bg-accent-soft text-accent-text'
          : 'border border-border bg-surface text-text shadow-card',
        className,
      )}
    >
      <Info aria-hidden="true" size={18} strokeWidth={1.75} className="mt-0.5 shrink-0" />
      <div className="flex flex-col gap-1">
        {title ? <p className="text-card">{title}</p> : null}
        <div className={cn(tone === 'surface' && 'text-text-muted')}>{children}</div>
      </div>
    </div>
  );
}
