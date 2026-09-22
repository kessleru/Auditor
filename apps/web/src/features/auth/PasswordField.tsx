import { type InputHTMLAttributes, type Ref, useId, useState } from 'react';
import { cn } from '../../components/ui';

export interface PasswordFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'id'
> {
  label: string;
  error?: string;
  ref?: Ref<HTMLInputElement>;
}

/** Campo de senha com botão "Mostrar/Ocultar"; o texto do botão diz o que ele fará. */
export function PasswordField({ label, error, ref, ...props }: PasswordFieldProps) {
  const id = useId();
  const errorId = `${id}-erro`;
  const [visible, setVisible] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-label font-medium text-text">
        {label}
      </label>
      <div className="relative">
        <input
          ref={ref}
          id={id}
          type={visible ? 'text' : 'password'}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            'min-h-11 w-full rounded-md border bg-surface pr-24 pl-3 text-body text-text',
            error ? 'border-critical' : 'border-border-strong',
          )}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-controls={id}
          aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
          className="absolute top-1/2 right-1.5 min-h-8 -translate-y-1/2 rounded-md px-2.5 text-label font-medium text-accent hover:bg-muted"
        >
          {visible ? 'Ocultar' : 'Mostrar'}
        </button>
      </div>
      {error ? (
        <p id={errorId} className="text-label text-critical-text">
          {error}
        </p>
      ) : null}
    </div>
  );
}
