import { useId } from 'react';
import { ButtonLink } from '../../components/ui';
import { formatDate } from '../../lib/format';
import { useAuditDraft, useDiscoveries } from './api';
import { discoveryCounts } from './draftParts';

/**
 * Auditoria em montagem no Painel (ADR 0017): onde parou e como vai a descoberta de rotas em
 * segundo plano, com o atalho para continuar.
 */
export function DraftCard() {
  const headingId = useId();
  const draft = useAuditDraft();
  const saved = draft.data;
  const discoveries = useDiscoveries(saved?.step === 'routes' ? saved.scope.institutionIds : []);
  if (!saved) return null;

  const institutions = saved.scope.institutionIds.length;
  const functions = saved.scope.functions.length;
  const counts = discoveryCounts(discoveries.data ?? []);
  const active = counts.queued + counts.running;

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-surface p-5 shadow-card"
    >
      <div className="flex min-w-0 flex-1 basis-64 flex-col gap-1">
        <h2 id={headingId} className="text-card text-text">
          Auditoria em montagem
        </h2>
        <p className="text-body text-text-muted">
          {institutions} {institutions === 1 ? 'instituição' : 'instituições'}, {functions}{' '}
          {functions === 1 ? 'página' : 'páginas'} por instituição · parou na{' '}
          {saved.step === 'routes' ? 'revisão de rotas' : 'definição do escopo'} · desde{' '}
          {formatDate(saved.createdAt)}
        </p>
        {saved.step === 'routes' && discoveries.data ? (
          <p className="text-body text-text-muted">
            {active > 0
              ? `Descoberta de rotas em segundo plano: ${counts.running} em andamento, ${counts.queued} na fila, ${counts.completed} ${counts.completed === 1 ? 'concluída' : 'concluídas'}.`
              : `Descoberta de rotas: ${counts.completed} ${counts.completed === 1 ? 'concluída' : 'concluídas'}${counts.failed > 0 ? `, ${counts.failed} com falha` : ''}.`}
          </p>
        ) : null}
      </div>
      <ButtonLink to="/auditorias/nova">Continuar de onde parou</ButtonLink>
    </section>
  );
}
