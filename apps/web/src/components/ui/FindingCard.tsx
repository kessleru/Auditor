import type { Severity, WcagPrinciple } from '@auditoria-rf/contracts';
import type { ReactNode } from 'react';
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
  /** Critério WCAG (achado automatizado)... */
  wcagCriteria?: string;
  principle?: WcagPrinciple;
  /** ...ou outra referência, como a heurística violada (achado da inspeção). */
  reference?: string;
  description: string;
  pageUrl?: string;
  snippet?: string;
  recommendation: ReactNode;
  /** Problema de template: presente em todas (ou quase todas) as páginas avaliadas. */
  template?: boolean;
  /** Linha extra de contexto, ex.: "em 4 de 4 páginas · 6 ocorrências". */
  meta?: ReactNode;
  headingLevel?: 2 | 3 | 4;
}

/** Card de problema: origem, critério, página, trecho de código e recomendação. */
export function FindingCard({
  title,
  severity,
  origin,
  wcagCriteria,
  principle,
  reference,
  description,
  pageUrl,
  snippet,
  recommendation,
  template = false,
  meta,
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
        {template ? <Badge variant="neutral">Template</Badge> : null}
        <span className="text-label text-text-muted">
          {reference ??
            (wcagCriteria && principle
              ? `WCAG ${wcagCriteria} — ${principleLabels[principle]}`
              : '')}
        </span>
      </div>
      <Heading className="mt-3 text-card text-text">{title}</Heading>
      <p className="mt-2 text-body text-text-muted">{description}</p>
      {pageUrl ? (
        <p className="mt-2 text-label text-text-muted">
          Página: <span className="break-all">{pageUrl}</span>
        </p>
      ) : null}
      {meta ? <p className="mt-1 text-label text-text-muted">{meta}</p> : null}
      {snippet ? (
        <pre className="mt-3 rounded-md bg-muted px-3 py-2 font-mono text-code break-all whitespace-pre-wrap text-text">
          <code>{snippet}</code>
        </pre>
      ) : null}
      <p className="mt-3 text-label text-text">
        <span className="font-medium">Correção:</span> {recommendation}
      </p>
    </article>
  );
}
