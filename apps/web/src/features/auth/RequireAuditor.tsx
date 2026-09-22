import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { Button, ErrorState } from '../../components/ui';
import { useAuditor } from './useAuditor';

/** Rotas do auditor: sem sessão, vai para /entrar e volta depois do login. */
export function RequireAuditor({ children }: { children: ReactNode }) {
  const { data: auditor, isPending, isError, refetch } = useAuditor();
  const location = useLocation();

  if (isPending) {
    return (
      <p role="status" className="p-8 text-body text-text-muted">
        Carregando…
      </p>
    );
  }
  if (isError) {
    return (
      <main id="conteudo" className="p-8">
        <ErrorState
          title="Não foi possível verificar a sessão"
          description="O servidor não respondeu. Verifique a conexão e tente novamente."
          action={
            <Button variant="secondary" onClick={() => void refetch()}>
              Tentar novamente
            </Button>
          }
        />
      </main>
    );
  }
  if (!auditor) {
    const voltar = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/entrar?voltar=${voltar}`} replace />;
  }
  return children;
}
