import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Button, ErrorState } from '../../components/ui';

/** Carregando / erro / conteúdo de uma consulta, com mensagens anunciadas. */
export function QueryState<T>({
  query,
  loadingText,
  errorTitle,
  skeleton,
  children,
}: {
  query: UseQueryResult<T>;
  loadingText: string;
  /** Skeleton no lugar do texto, só quando o tamanho do conteúdo é conhecido. */
  skeleton?: ReactNode;
  errorTitle: string;
  children: (data: T) => ReactNode;
}) {
  if (query.isPending) {
    if (skeleton) return <>{skeleton}</>;
    return (
      <p role="status" className="text-body text-text-muted">
        {loadingText}
      </p>
    );
  }
  if (query.isError) {
    return (
      <div role="alert">
        <ErrorState
          title={errorTitle}
          description={query.error.message}
          action={
            <Button variant="secondary" onClick={() => void query.refetch()}>
              Tentar novamente
            </Button>
          }
        />
      </div>
    );
  }
  return <>{children(query.data)}</>;
}
