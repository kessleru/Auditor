import { Link } from 'react-router';
import { PageTitle } from '../components/ui';

export function NotFoundPage() {
  return (
    <div className="flex flex-col gap-4">
      <PageTitle>Página não encontrada</PageTitle>
      <p className="text-body text-text-muted">O endereço digitado não existe ou foi alterado.</p>
      <p>
        <Link to="/" className="text-accent-text underline underline-offset-2 hover:decoration-2">
          Voltar para os resultados
        </Link>
      </p>
    </div>
  );
}
