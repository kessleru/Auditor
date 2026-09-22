import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Button, ErrorState } from '../../components/ui';

/** Carregando / erro / conteúdo de uma consulta, com mensagens anunciadas. */
export function QueryState<T>({
  query,
  loadingText,
  errorTitle,
  children,
}: {
  query: UseQueryResult<T>;
  loadingText: string;
  errorTitle: string;
  children: (data: T) => ReactNode;
}) {
  if (query.isPending) {
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
