import {
  type AssistiveCheck,
  assistiveCheckTexts,
  type AssistiveCheckState,
  pageFunctionLabels,
  type Severity,
} from '@auditoria-rf/contracts';
import { type FormEvent, useId, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router';
import { Badge, type BadgeVariant, Button, Choice, EmptyState, Note } from '../../components/ui';
import { ApiError } from '../../lib/api';
import { QueryState } from '../results/QueryState';
import { usePortalAssistive, useSaveAssistiveCheck } from './api';
import type { PortalContext } from './context';

const stateLabels: Record<AssistiveCheckState, { label: string; variant: BadgeVariant }> = {
  pass: { label: 'Conforme', variant: 'good' },
  barrier: { label: 'Barreira', variant: 'critical' },
  not_applicable: { label: 'Não se aplica', variant: 'neutral' },
  pending: { label: 'Pendente', variant: 'neutral' },
};

function CheckItem({ pageId, check }: { pageId: number; check: AssistiveCheck }) {
  const { collectionId, institutionId } = useOutletContext<PortalContext>();
  const save = useSaveAssistiveCheck(collectionId, institutionId);
  const [state, setState] = useState<AssistiveCheckState>(check.state);
  const [severity, setSeverity] = useState<Severity | null>(check.severity);
  const [note, setNote] = useState(check.note ?? '');
  const text = assistiveCheckTexts[check.kind];
  const titleId = useId();
  const barrier = state === 'barrier';
  const dirty = state !== check.state || severity !== check.severity || note !== (check.note ?? '');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate({ pageId, kind: check.kind, state, severity: barrier ? severity : null, note });
  };

  return (
    <li className="px-5 py-4">
      <form onSubmit={submit} aria-labelledby={titleId} className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <h2 id={titleId} className="text-card text-text">
              {text.title}
            </h2>
            <p className="text-body text-text-muted">{text.description}</p>
            <p className="text-label text-text-muted">{text.nature}</p>
          </div>
          <Badge variant={stateLabels[check.state].variant}>{stateLabels[check.state].label}</Badge>
        </div>
        <fieldset className="flex flex-wrap gap-x-5">
          <legend className="sr-only">Resultado: {text.title}</legend>
          {(['pass', 'barrier', 'not_applicable'] as const).map((s) => (
            <Choice
              key={s}
              type="radio"
              name={`${pageId}-${check.kind}`}
              checked={state === s}
              onChange={() => setState(s)}
              label={stateLabels[s].label}
            />
          ))}
        </fieldset>
        {barrier ? (
          <fieldset className="flex flex-wrap gap-x-5">
            <legend className="mb-1 text-label font-medium">Severidade da barreira</legend>
            <Choice
              type="radio"
              name={`${pageId}-${check.kind}-sev`}
              checked={severity === 'critical'}
              onChange={() => setSeverity('critical')}
              label="Crítico"
            />
            <Choice
              type="radio"
              name={`${pageId}-${check.kind}-sev`}
              checked={severity === 'moderate'}
              onChange={() => setSeverity('moderate')}
              label="Moderado"
            />
          </fieldset>
        ) : null}
        <label className="flex flex-col gap-1.5 text-label font-medium">
          Observação{barrier ? ' (obrigatória)' : ''}
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="rounded-md border border-border-strong bg-surface px-3 py-2 text-body font-normal"
          />
        </label>
        {save.error ? (
          <p role="alert" className="text-label text-critical-text">
            {save.error instanceof ApiError ? save.error.message : 'Não foi possível salvar.'}
          </p>
        ) : null}
        <div>
          <Button
            type="submit"
            variant="secondary"
            className="min-h-9"
            disabled={
              !dirty ||
              state === 'pending' ||
              (barrier && (!severity || note.trim().length < 3)) ||
              save.isPending
            }
          >
            Salvar verificação
          </Button>
        </div>
      </form>
    </li>
  );
}

/** Tela 3.2: checklist de verificação assistiva, uma página por vez. */
export function AssistiveTab() {
  const { collectionId, institutionId } = useOutletContext<PortalContext>();
  const pages = usePortalAssistive(collectionId, institutionId);
  const [params, setParams] = useSearchParams();
  const selectId = useId();

  return (
    <QueryState
      query={pages}
      loadingText="Carregando páginas…"
      errorTitle="Não foi possível carregar as páginas"
    >
      {(list) => {
        if (list.length === 0) return <EmptyState title="Nenhuma página avaliada" />;
        const current = list.find((p) => p.id === Number(params.get('pagina'))) ?? list[0]!;
        const index = list.indexOf(current);
        const done = current.checks.filter((c) => c.state !== 'pending').length;
        const total = current.checks.length;
        return (
          <div className="flex flex-col gap-5">
            <form
              className="flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const value = (e.currentTarget.elements.namedItem('pagina') as HTMLSelectElement)
                  .value;
                setParams({ pagina: value });
              }}
            >
              <label htmlFor={selectId} className="text-label font-medium">
                Página em verificação
              </label>
              <select
                id={selectId}
                name="pagina"
                defaultValue={current.id}
                key={current.id}
                className="min-h-10 w-full max-w-xl min-w-0 rounded-md border border-border-strong bg-surface px-2 text-label"
              >
                {list.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.functionKey ? pageFunctionLabels[p.functionKey] : 'Página'} —{' '}
                    {p.url.replace(/^https?:\/\//, '')}
                  </option>
                ))}
              </select>
              <Button type="submit" variant="secondary" className="min-h-10 px-3">
                Ir
              </Button>
              <p className="text-label text-text-muted">
                Página {index + 1} de {list.length}, com {done} de {total} verificações registradas
              </p>
            </form>
            <ul
              key={current.id}
              className="flex flex-col divide-y divide-border rounded-lg bg-surface shadow-card"
            >
              {current.checks.map((check) => (
                <CheckItem key={check.kind} pageId={current.id} check={check} />
              ))}
            </ul>
            <Note title="Simulação não substitui avaliação com usuários">
              Estas verificações são conduzidas pelo pesquisador e identificam barreiras
              estruturais. Não equivalem ao uso cotidiano por pessoas com deficiência, registrado no
              projeto como trabalho futuro.
            </Note>
          </div>
        );
      }}
    </QueryState>
  );
}
