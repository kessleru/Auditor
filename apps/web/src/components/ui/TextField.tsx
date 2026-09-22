import { type InputHTMLAttributes, type Ref, useId } from 'react';
import { Search } from 'lucide-react';
import { cn } from './cn';

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  hint?: string;
  error?: string;
  id?: string;
  ref?: Ref<HTMLInputElement>;
}

/**
 * Campo com rótulo visível acima; o placeholder nunca substitui o rótulo. Dica e erro ficam
 * ligados ao campo por `aria-describedby`.
 */
export function TextField({ label, hint, error, id, className, ref, ...props }: TextFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = hint ? `${inputId}-dica` : undefined;
  const errorId = error ? `${inputId}-erro` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={inputId} className="text-label font-medium text-text">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        className={cn(
          'min-h-10 rounded-md border bg-surface px-3 text-body text-text placeholder:text-text-muted',
          error ? 'border-critical' : 'border-border-strong',
        )}
        {...props}
      />
      {/* Dica abaixo do campo: acima dele, empurraria o campo para baixo e desalinharia os
          campos vizinhos numa linha com vários deles. */}
      {hint ? (
        <p id={hintId} className="text-label text-text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-label text-critical-text">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export type SearchFieldProps = Omit<TextFieldProps, 'type'>;

/** Campo de busca: mesmo contrato do TextField, com ícone decorativo. */
export function SearchField({ label, id, className, ref, ...props }: SearchFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={inputId} className="text-label font-medium text-text">
        {label}
      </label>
      <div className="relative">
        <Search
          aria-hidden="true"
          size={16}
          strokeWidth={1.75}
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-text-muted"
        />
        <input
          ref={ref}
          id={inputId}
          type="search"
          className="min-h-10 w-full rounded-md border border-border-strong bg-surface pr-3 pl-9 text-body text-text placeholder:text-text-muted"
          {...props}
        />
      </div>
    </div>
  );
}
