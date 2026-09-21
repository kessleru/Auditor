import { cn } from './cn';

function Mark({ ring, size }: { ring: boolean; size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={ring ? '0 0 64 64' : '7 7 50 50'}
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {ring ? (
        <rect x="1.5" y="1.5" width="61" height="61" rx="18.5" stroke="#1F4FA8" strokeWidth="2.5" />
      ) : null}
      <rect x="7" y="7" width="50" height="50" rx="13" fill="#1F4FA8" />
      <path
        d="M19.5 46 L31 17.5 L42.5 46"
        stroke="#FFFFFF"
        strokeWidth="5.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M22.5 34.5 L28.6 40.2 L46 22.5"
        stroke="#7FE0B0"
        strokeWidth="5.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export interface LogoProps {
  variant?: 'symbol' | 'compact' | 'horizontal';
  /** Subtítulo "Acessibilidade e usabilidade" (barra do visitante e login). */
  subtitle?: boolean;
  className?: string;
}

/**
 * Marca (seção 4.1). O SVG é sempre decorativo: quando a logo é link, o nome acessível vem do link
 * ("Auditoria RF — início"); sozinha, o texto "Auditoria RF" fica visível ou oculto para leitores.
 */
export function Logo({ variant = 'horizontal', subtitle = false, className }: LogoProps) {
  if (variant !== 'horizontal') {
    return (
      <span className={cn('inline-flex', className)}>
        <Mark ring={variant === 'symbol'} size={variant === 'symbol' ? 40 : 24} />
        <span className="sr-only">Auditoria RF</span>
      </span>
    );
  }
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <Mark ring size={36} />
      <span className="flex flex-col">
        <span className="text-card text-text">
          Auditoria <span className="text-accent">RF</span>
        </span>
        {subtitle ? (
          <span className="text-label text-text-muted">Acessibilidade e usabilidade</span>
        ) : null}
      </span>
    </span>
  );
}
