import type { InspectionPortal } from '@auditoria-rf/contracts';
import { type FormEvent, useId, useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  Badge,
  type BadgeVariant,
  Button,
  ButtonLink,
  Choice,
  DataTable,
  EmptyState,
  Note,
  PageTitle,
} from '../../components/ui';
import { ApiError } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { QueryState } from '../results/QueryState';
import { useInspectionSummary, useSetSample } from './api';

const statusBadge: Record<InspectionPortal['status'], { label: string; variant: BadgeVariant }> = {
  not_started: { label: 'Não iniciada', variant: 'neutral' },
  in_progress: { label: 'Em andamento', variant: 'moderate' },
  done: { label: 'Concluída', variant: 'good' },
};
const action: Record<InspectionPortal['status'], string> = {
  not_started: 'Iniciar',
  in_progress: 'Continuar',
  done: 'Revisar',
};

function SampleForm({
  collectionId,
  sample,
  candidates,
}: {
  collectionId: number;
  sample: number[];
  candidates: { institutionId: number; acronym: string; name: string }[];
}) {
  const setSample = useSetSample(collectionId);
  const [picked, setPicked] = useState<number[]>([]);
  const headingId = useId();
  if (candidates.length === 0) return null;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSample.mutate([...sample, ...picked], { onSuccess: () => setPicked([]) });
  };
  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-3 rounded-lg bg-surface p-5 shadow-card"
    >
      <h2 id={headingId} className="text-card text-text">
        Incluir portais na subamostra
      </h2>
      <p className="text-body text-text-muted">
        Só portais avaliados nesta coleta. A escolha fica registrada com data e auditor.
      </p>
      <form onSubmit={submit} className="flex flex-col gap-2">
        {candidates.map((c) => (
          <Choice
            key={c.institutionId}
            type="checkbox"
            checked={picked.includes(c.institutionId)}
            onChange={() =>
              setPicked((p) =>
                p.includes(c.institutionId)
                  ? p.filter((x) => x !== c.institutionId)
                  : [...p, c.institutionId],
              )
            }
            label={
              <>
                <span className="font-medium">{c.acronym}</span>{' '}
                <span className="text-text-muted">— {c.name}</span>
              </>
            }
          />
        ))}
        {setSample.error ? (
          <p role="alert" className="text-label text-critical-text">
            {setSample.error instanceof ApiError
              ? setSample.error.message
              : 'Não foi possível salvar.'}
          </p>
        ) : null}
        <div>
          <Button type="submit" disabled={picked.length === 0 || setSample.isPending}>
            Incluir na subamostra
          </Button>
        </div>
      </form>
    </section>
  );
}

/** Tela 3.0: portais da subamostra, com o progresso das três atividades. */
export function InspectionCollectionPage() {
  const collectionId = Number(useParams().collectionId);
  const summary = useInspectionSummary(collectionId);

  return (
    <div className="flex flex-col gap-6">
      <QueryState
        query={summary}
        loadingText="Carregando inspeção…"
        errorTitle="Não foi possível carregar a inspeção"
      >
        {({ collection, sample, candidates, withoutData }) => (
          <>
            <div className="flex flex-col gap-1">
              <PageTitle documentTitle={`Inspeção manual — coleta #${collection.id}`}>
                Inspeção manual
              </PageTitle>
              <p className="text-label text-text-muted">
                Coleta #{collection.id}
                {collection.finishedAt ? ` de ${formatDate(collection.finishedAt)}` : ''} ·
                subamostra de {sample.length} {sample.length === 1 ? 'portal' : 'portais'}
              </p>
            </div>
            <Note>
              A inspeção é feita um portal por vez. Escolha o portal para validar os achados,
              executar as tarefas-alvo e a verificação assistiva — as três atividades ficam reunidas
              na página do portal.
            </Note>

            {sample.length === 0 ? (
              <EmptyState
                title="Subamostra vazia"
                description="Escolha abaixo os portais que passam pela inspeção manual."
              />
            ) : (
              <DataTable
                caption="Portais da subamostra"
                captionHidden
                rows={sample}
                rowKey={(r) => r.institutionId}
                columns={[
                  {
                    key: 'portal',
                    header: 'Portal',
                    rowHeader: true,
                    cell: (r) => (
                      <span className="flex flex-col">
                        <span className="font-medium">{r.acronym}</span>
                        <span className="text-label text-text-muted">{r.domain}</span>
                      </span>
                    ),
                  },
                  {
                    key: 'findings',
                    header: 'Validação de achados',
                    cell: (r) =>
                      r.findings.pending === 0 ? (
                        <Badge variant="good">Concluída</Badge>
                      ) : (
                        <Badge
                          variant={
                            r.findings.pending < r.findings.problems ? 'moderate' : 'neutral'
                          }
                        >
                          {r.findings.pending} {r.findings.pending === 1 ? 'pendente' : 'pendentes'}
                        </Badge>
                      ),
                  },
                  {
                    key: 'tasks',
                    header: 'Tarefas-alvo',
                    cell: (r) => `${r.tasks.done} de ${r.tasks.total}`,
                  },
                  {
                    key: 'assistive',
                    header: 'Verificação assistiva',
                    cell: (r) => `${r.assistive.done} de ${r.assistive.total} páginas`,
                  },
                  {
                    key: 'status',
                    header: 'Situação',
                    cell: (r) => (
                      <Badge variant={statusBadge[r.status].variant}>
                        {statusBadge[r.status].label}
                      </Badge>
                    ),
                  },
                  {
                    key: 'action',
                    header: 'Ação',
                    align: 'end',
                    cell: (r) => (
                      <ButtonLink
                        to={`/inspecao/${collectionId}/${r.institutionId}/validacao`}
                        variant={r.status === 'in_progress' ? 'primary' : 'secondary'}
                        aria-label={`${action[r.status]} inspeção do ${r.acronym}`}
                        className="min-h-9"
                      >
                        {action[r.status]}
                      </ButtonLink>
                    ),
                  },
                ]}
              />
            )}

            {withoutData.length > 0 ? (
              <p className="text-label text-text-muted">
                {withoutData.map((w) => w.acronym).join(', ')}{' '}
                {withoutData.length === 1 ? 'não entra' : 'não entram'} na inspeção: a coleta
                automatizada não obteve dados
                {withoutData.length === 1 ? ' desse portal' : ' desses portais'}.
              </p>
            ) : null}

            <SampleForm
              collectionId={collectionId}
              sample={sample.map((s) => s.institutionId)}
              candidates={candidates}
            />
            <p className="text-label">
              <Link
                to="/inspecao"
                className="text-accent-text underline underline-offset-2 hover:decoration-2"
              >
                Escolher outra coleta
              </Link>
            </p>
          </>
        )}
      </QueryState>
    </div>
  );
}
