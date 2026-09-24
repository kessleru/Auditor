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
  /** Ações sobre o problema (ex.: validação), dentro do card. */
  actions?: ReactNode;
}

/**
 * Card de problema. O que decide a leitura fica à vista: título, severidade, critério, onde
 * aparece e o trecho de código. Descrição da regra, página e como corrigir ficam em "Detalhes".
 * A origem só aparece quando é da inspeção manual: automatizado é o caso comum.
 */
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
  actions,
}: FindingCardProps) {
  const Heading = `h${headingLevel}` as const;
  const criterion =
    reference ??
    (wcagCriteria && principle ? `WCAG ${wcagCriteria} · ${principleLabels[principle]}` : null);
  const manual = origin === 'inspection';
  return (
    <article className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <Heading className="min-w-0 flex-1 basis-60 text-card text-text">{title}</Heading>
        <div className="flex flex-wrap gap-2">
          <Badge variant={severity === 'critical' ? 'critical' : 'moderate'}>
            {severity === 'critical' ? 'Crítico' : 'Moderado'}
          </Badge>
          {template ? <Badge variant="neutral">Template</Badge> : null}
          {manual ? <Badge variant="inspection">Inspeção</Badge> : null}
        </div>
      </div>
      {criterion || meta ? (
        <p className="text-label text-text-muted">
          {criterion}
          {criterion && meta ? ' · ' : null}
          {meta}
        </p>
      ) : null}
      {manual ? <p className="text-body text-text">{description}</p> : null}
      {snippet ? (
        <pre className="rounded-md bg-muted px-3 py-2 font-mono text-code break-all whitespace-pre-wrap text-text">
          <code>{snippet}</code>
        </pre>
      ) : null}
      <details className="text-label text-text-muted">
        <summary className="w-fit cursor-pointer text-accent-text underline underline-offset-2 hover:decoration-2">
          Detalhes e como corrigir
        </summary>
        <div className="mt-2 flex flex-col gap-1">
          {manual ? null : <p className="text-body text-text-muted">{description}</p>}
          {pageUrl ? (
            <p>
              Página: <span className="break-all">{pageUrl}</span>
            </p>
          ) : null}
          <p className="text-text">
            <span className="font-medium">Correção:</span> {recommendation}
          </p>
        </div>
      </details>
      {actions ? <div className="flex flex-wrap items-start gap-2">{actions}</div> : null}
    </article>
  );
}
