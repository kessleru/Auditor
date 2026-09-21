import { useEffect, useRef } from 'react';
import { cn } from './cn';

export const APP_NAME = 'Auditoria RF';

/**
 * `<h1>` da página. Atualiza o `<title>` do documento e é o alvo do foco após cada navegação
 * (`useFocusOnNavigation`), por isso tem `tabIndex={-1}`.
 */
export function PageTitle({
  children,
  documentTitle,
  className,
}: {
  children: string;
  /** Título do documento quando difere do texto do `<h1>`. */
  documentTitle?: string;
  className?: string;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  const title = documentTitle ?? children;

  useEffect(() => {
    document.title = `${title} · ${APP_NAME}`;
  }, [title]);

  return (
    <h1 ref={ref} tabIndex={-1} className={cn('text-page text-text', className)}>
      {children}
    </h1>
  );
}
