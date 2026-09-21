import type { Severity, WcagPrinciple } from '@auditoria-rf/contracts';
import { Badge } from './Badge';

const principleLabels: Record<WcagPrinciple, string> = {
  perceivable: 'perceptível',
  operable: 'operável',
  understandable: 'compreensível',
  robust: 'robusto',
};

export interface FindingCardProps {
  title: string;
  severity: Severity;
  origin: 'automated' | 'inspection';
  wcagCriteria: string;
  principle: WcagPrinciple;
  description: string;
  pageUrl: string;
  snippet?: string;
  recommendation: string;
  headingLevel?: 2 | 3 | 4;
}

/** Card de problema: origem, critério, página, trecho de código e recomendação. */
export function FindingCard({
  title,
  severity,
  origin,
  wcagCriteria,
  principle,
  description,
  pageUrl,
  snippet,
  recommendation,
  headingLevel = 3,
}: FindingCardProps) {
  const Heading = `h${headingLevel}` as const;
  return (
    <article className="rounded-lg border border-border bg-surface p-5 shadow-card">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={severity === 'critical' ? 'critical' : 'moderate'}>
          {severity === 'critical' ? 'Crítico' : 'Moderado'}
        </Badge>
        <Badge variant={origin}>{origin === 'automated' ? 'Automatizada' : 'Inspeção'}</Badge>
        <span className="text-label text-text-muted">
          WCAG {wcagCriteria} — {principleLabels[principle]}
        </span>
      </div>
      <Heading className="mt-3 text-card text-text">{title}</Heading>
      <p className="mt-2 text-body text-text-muted">{description}</p>
      <p className="mt-2 text-label text-text-muted">
        Página: <span className="break-all">{pageUrl}</span>
      </p>
      {snippet ? (
        <pre className="mt-3 overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-code text-text">
          <code>{snippet}</code>
        </pre>
      ) : null}
      <p className="mt-3 text-label text-text">
        <span className="font-medium">Correção:</span> {recommendation}
      </p>
    </article>
  );
}
