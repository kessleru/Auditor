import type { LucideIcon } from 'lucide-react';
import { NavLink } from 'react-router';
import { cn } from './cn';

export interface NavItemProps {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  onNavigate?: () => void;
}

/**
 * Item de navegação. Ativo = fundo `accent-soft`, texto `accent-text`, barra de 3 px e
 * `aria-current="page"` (o NavLink aplica o atributo).
 */
export function NavItem({ to, label, icon: Icon, end, onNavigate }: NavItemProps) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'relative flex min-h-9 items-center gap-3 rounded-md px-3 text-body transition-colors duration-150',
          isActive
            ? 'bg-accent-soft font-medium text-accent-text before:absolute before:top-1.5 before:bottom-1.5 before:left-0 before:w-[3px] before:rounded-full before:bg-accent'
            : 'text-text hover:bg-muted',
        )
      }
    >
      <Icon aria-hidden="true" size={18} strokeWidth={1.75} className="shrink-0" />
      {label}
    </NavLink>
  );
}
