import type { DiscoveryProgress, DiscoveryState } from '@auditoria-rf/contracts';
import { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/ui';
import { ApiError } from '../../lib/api';
import { useDiscardAuditDraft } from './api';

/** Etapa da descoberta em andamento, com as páginas lidas quando já se sabe o teto. */
export function progressText(progress: DiscoveryProgress | null): string {
  switch (progress?.phase) {
    case 'sitemap':
      return 'Descobrindo rotas: lendo o sitemap…';
    case 'pages':
      return `Descobrindo rotas: ${progress.visited} de até ${progress.planned ?? '?'} páginas lidas.`;
    case 'checks':
      return 'Descobrindo rotas: conferindo as rotas já confirmadas…';
    default:
      return 'Descobrindo rotas: lendo o robots.txt e a página inicial…';
  }
}

/** Situação curta da descoberta de uma instituição, para tabelas e resumos. */
export function discoveryShortText(state: DiscoveryState | undefined): string {
  switch (state?.status) {
    case 'queued':
      return 'Na fila';
    case 'running':
      return state.progress?.phase === 'pages'
        ? `Descobrindo: ${state.progress.visited} de até ${state.progress.planned ?? '?'} páginas`
        : 'Descobrindo…';
    case 'completed':
      return state.summary
        ? `Concluída: ${state.summary.withSuggestion} ${state.summary.withSuggestion === 1 ? 'sugestão' : 'sugestões'}`
        : 'Concluída';
    case 'failed':
      return 'Falhou';
    default:
      return 'Não feita';
  }
}

/** Quantas descobertas estão em cada situação: "2 na fila, 1 em andamento, 3 concluídas". */
export function discoveryCounts(states: readonly DiscoveryState[]) {
  const count = (status: DiscoveryState['status']) =>
    states.filter((s) => s.status === status).length;
  return {
    queued: count('queued'),
    running: count('running'),
    completed: count('completed'),
    failed: count('failed'),
    idle: count('idle'),
  };
}

/**
 * Descartar a auditoria em montagem, com confirmação na própria tela. As decisões sobre as rotas
 * de cada instituição não se perdem: ficam gravadas nas instituições.
 */
export function DiscardDraft({
  onConfirm,
  onDiscarded,
}: {
  /** Antes de descartar (ex.: cancelar o salvamento automático pendente). */
  onConfirm?: () => void;
  onDiscarded?: () => void;
}) {
  const discard = useDiscardAuditDraft({ onDiscarded });
  const [confirming, setConfirming] = useState(false);
  // O botão clicado dá lugar à pergunta (e vice-versa): o foco vai junto, nunca para o <body>.
  const questionRef = useRef<HTMLParagraphElement>(null);
  const openRef = useRef<HTMLButtonElement>(null);
  const moved = useRef(false);
  useEffect(() => {
    if (!moved.current) return;
    (confirming ? questionRef.current : openRef.current)?.focus();
  }, [confirming]);
  const toggle = (next: boolean) => {
    moved.current = true;
    setConfirming(next);
  };

  if (!confirming) {
    return (
      <div>
        <Button ref={openRef} variant="secondary" onClick={() => toggle(true)}>
          Descartar esta auditoria
        </Button>
      </div>
    );
  }
  return (
    <div
      role="group"
      aria-label="Confirmar descarte"
      className="motion-safe:animate-enter flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface p-4"
    >
      <p ref={questionRef} tabIndex={-1} className="text-body">
        Descartar a auditoria em montagem? O escopo e a etapa salvos se perdem; as rotas já
        confirmadas e as descobertas feitas continuam gravadas em cada instituição.
      </p>
      <Button
        onClick={() => {
          onConfirm?.();
          discard.mutate();
        }}
        disabled={discard.isPending}
      >
        Confirmar descarte
      </Button>
      <Button variant="secondary" onClick={() => toggle(false)}>
        Manter
      </Button>
      {discard.error ? (
        <p role="alert" className="w-full text-label text-critical-text">
          {discard.error instanceof ApiError
            ? discard.error.message
            : 'Não foi possível descartar.'}
        </p>
      ) : null}
    </div>
  );
}
