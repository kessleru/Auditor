import {
  Activity,
  ChartColumn,
  CirclePlus,
  History,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  Target,
  X,
} from 'lucide-react';
import { useCallback, useId, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router';
import { Logo, NavItem, SkipLink, SlidingNavIndicator } from '../../components/ui';
import { RequireAuditor } from '../../features/auth/RequireAuditor';
import { useAuditor, useLogout } from '../../features/auth/useAuditor';
import { useFocusTrap } from '../useFocusTrap';

const groups = [
  {
    label: 'Auditorias',
    items: [
      { to: '/auditorias/nova', label: 'Nova auditoria', icon: CirclePlus },
      { to: '/coletas', label: 'Em andamento', icon: Activity, end: true },
      { to: '/historico', label: 'Histórico', icon: History },
    ],
  },
  {
    label: 'Inspeção manual',
    items: [{ to: '/inspecao', label: 'Portais em inspeção', icon: Target }],
  },
  {
    label: 'Resultados',
    items: [
      { to: '/painel', label: 'Painel', icon: LayoutDashboard },
      { to: '/comparativo', label: 'Comparativo', icon: ChartColumn },
      { to: '/gestao/instituicoes', label: 'Instituições', icon: Landmark },
    ],
  },
];

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const navId = useId();
  const { data: auditor } = useAuditor();
  const logout = useLogout();
  const navigate = useNavigate();
  const navRef = useRef<HTMLElement>(null);

  return (
    <div className="flex h-full flex-col gap-6 px-4 py-5">
      <Link
        to="/painel"
        aria-label="Auditoria RF — início"
        className="self-start rounded-md"
        onClick={onNavigate}
      >
        <Logo />
      </Link>

      <nav ref={navRef} aria-label="Principal" className="relative flex flex-1 flex-col gap-5">
        <SlidingNavIndicator container={navRef} />
        {groups.map((group, index) => (
          <div key={group.label} className="flex flex-col gap-1">
            <p id={`${navId}-${index}`} className="px-3 text-label font-medium text-text-muted">
              {group.label}
            </p>
            <ul aria-labelledby={`${navId}-${index}`} className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavItem {...item} onNavigate={onNavigate} slidingIndicator />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="flex items-center gap-3 border-t border-border pt-4">
        {auditor ? (
          <>
            <span
              aria-hidden="true"
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-label font-medium text-accent-text"
            >
              {initials(auditor.name)}
            </span>
            <p className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-label font-medium text-text">{auditor.name}</span>
              <span className="text-label text-text-muted">Auditor</span>
            </p>
          </>
        ) : (
          <span className="flex-1" />
        )}
        <button
          type="button"
          onClick={() => logout.mutate(undefined, { onSuccess: () => void navigate('/entrar') })}
          disabled={logout.isPending}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 text-label font-medium text-accent-text underline underline-offset-2 hover:decoration-2 hover:bg-muted"
        >
          <LogOut aria-hidden="true" size={16} strokeWidth={1.75} />
          Sair
        </button>
      </div>
    </div>
  );
}

/** Layout do auditor: sidebar fixa de 240 px; no celular, menu com foco preso (seção 5.2). */
export function AuditorLayout() {
  return (
    <RequireAuditor>
      <AuditorShell />
    </RequireAuditor>
  );
}

function AuditorShell() {
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const drawer = useRef<HTMLDivElement>(null);
  const drawerId = useId();

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    menuButton.current?.focus();
  }, []);

  useFocusTrap(drawer, menuOpen, closeMenu);

  return (
    <div className="min-h-screen lg:pl-60">
      {/* Com a gaveta aberta, o resto da página fica inerte (fora do foco e do leitor de tela). */}
      <SkipLink />

      <aside className="fixed inset-y-0 left-0 hidden w-60 border-r border-border bg-surface lg:block">
        <SidebarContent />
      </aside>

      <header
        inert={menuOpen}
        className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-surface px-4 py-2 lg:hidden"
      >
        <button
          ref={menuButton}
          type="button"
          aria-expanded={menuOpen}
          aria-controls={drawerId}
          onClick={() => setMenuOpen((open) => !open)}
          className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border-strong px-3 text-label font-medium"
        >
          <Menu aria-hidden="true" size={18} strokeWidth={1.75} />
          Menu
        </button>
        <Logo />
      </header>

      <div
        hidden={!menuOpen}
        className="fixed inset-0 z-30 bg-text/40 motion-safe:animate-fade lg:hidden"
        aria-hidden="true"
        onClick={closeMenu}
      />
      <div
        ref={drawer}
        id={drawerId}
        role="dialog"
        aria-modal="true"
        aria-label="Menu de navegação"
        hidden={!menuOpen}
        className="fixed inset-y-0 left-0 z-40 w-72 max-w-[85vw] bg-surface shadow-float motion-safe:animate-drawer lg:hidden"
      >
        <button
          type="button"
          onClick={closeMenu}
          className="absolute top-4 right-3 inline-flex size-10 items-center justify-center rounded-md hover:bg-muted"
          aria-label="Fechar menu"
        >
          <X aria-hidden="true" size={18} strokeWidth={1.75} />
        </button>
        {/* Navegar pelo menu fecha a gaveta; o foco segue para o <h1> da nova página (Root). */}
        {menuOpen ? <SidebarContent onNavigate={() => setMenuOpen(false)} /> : null}
      </div>

      <main
        id="conteudo"
        tabIndex={-1}
        inert={menuOpen}
        className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8"
      >
        <div key={pathname} className="motion-safe:animate-enter">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
