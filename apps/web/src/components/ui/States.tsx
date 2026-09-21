import type { ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';

export interface StateProps {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  headingLevel?: 2 | 3;
}

/** Estado vazio (tela 5.1). */
export function EmptyState({ title, description, action, headingLevel = 2 }: StateProps) {
  const Heading = `h${headingLevel}` as const;
  return (
    <section className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface px-6 py-12 text-center">
      <Heading className="text-section text-text">{title}</Heading>
      {description ? <p className="max-w-prose text-body text-text-muted">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </section>
  );
}

/** Estado de erro (tela 2.2): ícone decorativo, texto sempre presente. */
export function ErrorState({ title, description, action, headingLevel = 2 }: StateProps) {
  const Heading = `h${headingLevel}` as const;
  return (
    <section className="flex gap-3 rounded-lg border border-border bg-critical-soft px-5 py-4">
      <TriangleAlert
        aria-hidden="true"
        size={18}
        strokeWidth={1.75}
        className="mt-0.5 shrink-0 text-critical"
      />
      <div className="flex flex-col gap-1">
        <Heading className="text-card text-critical-text">{title}</Heading>
        {description ? <div className="text-body text-text">{description}</div> : null}
        {action ? <div className="mt-2">{action}</div> : null}
      </div>
    </section>
  );
}
