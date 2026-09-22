import type { ButtonHTMLAttributes, ComponentProps } from 'react';
import { Link } from 'react-router';
import { cn } from './cn';

export type ButtonVariant = 'primary' | 'secondary';

/** Classes do botão, também usadas por links com aparência de botão. */
export function buttonClasses(variant: ButtonVariant = 'primary', className?: string) {
  return cn(
    'inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 text-label font-medium',
    'transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60',
    variant === 'primary' && 'bg-accent text-white hover:bg-accent-text',
    variant === 'secondary' && 'border border-border-strong bg-surface text-text hover:bg-muted',
    className,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

/** Ícone dentro do botão: sempre `aria-hidden`, com texto visível ao lado (seção 4.2). */
export function Button({ variant = 'primary', className, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={buttonClasses(variant, className)} {...props} />;
}

export interface ButtonLinkProps extends ComponentProps<typeof Link> {
  variant?: ButtonVariant;
}

export function ButtonLink({ variant = 'primary', className, ...props }: ButtonLinkProps) {
  return <Link className={buttonClasses(variant, className)} {...props} />;
}
