import type { ReactNode } from 'react';
import { cn } from './cn';
import { PageTitle } from './PageTitle';

export interface MetaItem {
  label: string;
  value: ReactNode;
}

export interface PageHeaderProps {
  title: string;
  documentTitle?: string;
  /** Contexto acima do título (padrão "caption" do GOV.UK), ex.: "Portal 1 de 6". */
  caption?: ReactNode;
  description?: ReactNode;
  /** Dados da página como pares rótulo/valor, no lugar de textos unidos por pontos. */
  meta?: MetaItem[];
  actions?: ReactNode;
  /** Trilha de navegação, acima de tudo. */
  breadcrumb?: ReactNode;
  className?: string;
}

/**
 * Cabeçalho único das telas: trilha, legenda, `<h1>`, descrição, metadados e ações. O mesmo padrão
 * em todas as páginas dá ao auditor um lugar fixo para cada informação.
 */
export function PageHeader({
  title,
  documentTitle,
  caption,
  description,
  meta,
  actions,
  breadcrumb,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn('flex flex-col gap-4', className)}>
      {breadcrumb}
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
        <div className="flex max-w-3xl min-w-0 flex-col gap-2">
          {caption ? <p className="text-label text-text-muted">{caption}</p> : null}
          <PageTitle documentTitle={documentTitle}>{title}</PageTitle>
          {description ? <div className="text-body text-text-muted">{description}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
      </div>
      {meta && meta.length > 0 ? (
        <dl className="flex flex-wrap gap-x-8 gap-y-2">
          {meta.map((item) => (
            <div key={item.label} className="flex flex-col">
              <dt className="text-label text-text-muted">{item.label}</dt>
              <dd className="text-label font-medium text-text tabular-nums">{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </header>
  );
}

export interface SectionProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  headingLevel?: 2 | 3;
  className?: string;
}

/** Seção da página: título (h2) perto do conteúdo, distância maior entre seções. */
export function Section({
  title,
  description,
  actions,
  children,
  headingLevel = 2,
  className,
}: SectionProps) {
  const Heading = `h${headingLevel}` as const;
  return (
    <section className={cn('flex flex-col gap-4', className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="flex flex-col gap-1">
          <Heading className="text-section text-text">{title}</Heading>
          {description ? <p className="text-body text-text-muted">{description}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

/** Coluna da página: 40 px entre blocos (cabeçalho, seções). */
export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-col gap-10', className)}>{children}</div>;
}
