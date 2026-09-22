import type { InputHTMLAttributes, ReactNode, Ref } from 'react';
import { cn } from './cn';

export interface ChoiceProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  type: 'checkbox' | 'radio';
  label: ReactNode;
  ref?: Ref<HTMLInputElement>;
}

/** Checkbox ou radio nativo com o rótulo inteiro clicável (alvo ≥ 24 px). */
export function Choice({ type, label, className, ref, ...props }: ChoiceProps) {
  return (
    <label
      className={cn(
        'flex min-h-8 cursor-pointer items-center gap-3 text-body text-text',
        className,
      )}
    >
      <input
        ref={ref}
        type={type}
        className="size-[18px] shrink-0 cursor-pointer accent-accent"
        {...props}
      />
      <span>{label}</span>
    </label>
  );
}
