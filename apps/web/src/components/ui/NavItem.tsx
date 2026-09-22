import type { LucideIcon } from 'lucide-react';
import { NavLink } from 'react-router';
import { cn } from './cn';

export interface NavItemProps {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  onNavigate?: () => void;
  /**
   * O fundo do item ativo é desenhado por um indicador externo que desliza entre os itens
   * (`SlidingNavIndicator`); aqui fica só a cor do texto.
   */
  slidingIndicator?: boolean;
}

/**
 * Item de navegação. Ativo = fundo `accent-soft`, texto `accent-text` e `aria-current="page"`
 * (o NavLink aplica o atributo).
 */
export function NavItem({
  to,
  label,
  icon: Icon,
  end,
  onNavigate,
  slidingIndicator = false,
}: NavItemProps) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'relative flex min-h-9 items-center gap-3 rounded-md px-3 text-body transition-colors duration-150',
          isActive && slidingIndicator && 'font-medium text-accent-text',
          isActive && !slidingIndicator && 'bg-accent-soft font-medium text-accent-text',
          !isActive && 'text-text hover:bg-muted',
        )
      }
    >
      <Icon aria-hidden="true" size={18} strokeWidth={1.75} className="shrink-0" />
      {label}
    </NavLink>
  );
}
