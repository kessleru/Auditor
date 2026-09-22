import { cn } from './cn';

/**
 * Bloco de carregamento estático (sem pulsar: nada de animação infinita, WCAG 2.2.2). Só deve ser
 * usado onde o tamanho final é conhecido, para não deslocar o layout. Sempre `aria-hidden`: quem usa
 * leitor de tela ouve o texto de status que acompanha o skeleton.
 */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn('block rounded-sm bg-muted', className)} />;
}

/** Mesmas medidas do `StatCard`: rótulo (18 px), métrica (36 px) e, se houver, uma linha de dica. */
export function StatCardSkeleton({ hint = false }: { hint?: boolean }) {
  return (
    <div aria-hidden="true" className="rounded-lg bg-surface p-5 shadow-card">
      <div className="flex flex-col gap-1">
        <Skeleton className="h-[18px] w-28" />
        <Skeleton className="h-9 w-20" />
      </div>
      {hint ? <Skeleton className="mt-2 h-[18px] w-36" /> : null}
    </div>
  );
}

/** Grade de indicadores em carregamento, com texto para leitores de tela. */
export function StatGridSkeleton({ hints, label }: { hints: boolean[]; label: string }) {
  return (
    <div className="flex flex-col gap-2">
      <p role="status" className="sr-only">
        {label}
      </p>
      <div className="grid gap-4 motion-safe:animate-fade sm:grid-cols-2 lg:grid-cols-4">
        {hints.map((hint, i) => (
          <StatCardSkeleton key={i} hint={hint} />
        ))}
      </div>
    </div>
  );
}
