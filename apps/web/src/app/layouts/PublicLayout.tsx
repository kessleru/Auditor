import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { cn, Logo, SkipLink } from '../../components/ui';

const links = [
  { to: '/', label: 'Resultados', end: true },
  { to: '/instituicoes', label: 'Instituições' },
  { to: '/metodologia', label: 'Sobre a metodologia' },
];

/** Layout do visitante: barra superior com marca, navegação e acesso do auditor (seção 5.2). */
export function PublicLayout() {
  const { pathname } = useLocation();
  return (
    <div className="flex min-h-screen flex-col">
      <SkipLink />
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-2 px-4 py-3 sm:px-6">
          <Link to="/" aria-label="Auditoria RF — início" className="rounded-md">
            <Logo subtitle />
          </Link>
          <nav aria-label="Principal" className="order-last w-full sm:order-none sm:w-auto">
            <ul className="flex flex-wrap gap-x-6">
              {links.map((link) => (
                <li key={link.to}>
                  <NavLink
                    to={link.to}
                    end={link.end}
                    className={({ isActive }) =>
                      cn(
                        'inline-flex min-h-11 items-center border-b-2 text-label transition-colors duration-150',
                        isActive
                          ? 'border-accent font-medium text-text'
                          : 'border-transparent text-text-muted hover:text-text',
                      )
                    }
                  >
                    {link.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <Link
            to="/entrar"
            className="ml-auto inline-flex min-h-11 items-center text-label font-medium text-accent-text underline underline-offset-4 hover:decoration-2"
          >
            Entrar como auditor
          </Link>
        </div>
      </header>

      <main
        id="conteudo"
        tabIndex={-1}
        className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6"
      >
        <div key={pathname} className="motion-safe:animate-enter">
          <Outlet />
        </div>
      </main>

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-5 text-label text-text-muted sm:px-6">
          <p>
            Auditoria RF — pesquisa acadêmica sobre acessibilidade e usabilidade dos portais da Rede
            Federal (TCC, Ciência da Computação, IFTM). Os indicadores cobrem apenas critérios
            verificáveis automaticamente;{' '}
            <Link
              to="/metodologia"
              className="text-accent-text underline underline-offset-2 hover:decoration-2"
            >
              veja a metodologia
            </Link>
            .
          </p>
        </div>
      </footer>
    </div>
  );
}
