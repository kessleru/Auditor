import { useRef } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { buttonClasses, cn, Logo, SkipLink, SlidingNavIndicator } from '../../components/ui';

const links = [
  { to: '/', label: 'Resultados', end: true },
  { to: '/instituicoes', label: 'Instituições' },
  { to: '/metodologia', label: 'Sobre a metodologia' },
];

/** Layout do visitante: barra superior com marca, navegação e acesso do auditor (seção 5.2). */
export function PublicLayout() {
  const { pathname } = useLocation();
  const navList = useRef<HTMLElement>(null);
  return (
    <div className="flex min-h-screen flex-col">
      <SkipLink />
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-2 px-4 py-3 sm:px-6">
          <Link to="/" aria-label="Auditoria RF — início" className="rounded-md">
            <Logo subtitle />
          </Link>
          <nav
            ref={navList}
            aria-label="Principal"
            className="relative order-last w-full sm:order-none sm:w-auto"
          >
            <SlidingNavIndicator container={navList} orientation="horizontal" />
            <ul className="flex flex-wrap gap-x-1">
              {links.map((link) => (
                <li key={link.to}>
                  <NavLink
                    to={link.to}
                    end={link.end}
                    className={({ isActive }) =>
                      cn(
                        'relative inline-flex min-h-11 items-center rounded-md px-3 text-label transition-colors duration-150',
                        isActive
                          ? 'font-medium text-accent-text'
                          : 'text-text-muted hover:bg-muted hover:text-text',
                      )
                    }
                  >
                    {link.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <Link to="/entrar" className={cn(buttonClasses('primary'), 'ml-auto')}>
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
