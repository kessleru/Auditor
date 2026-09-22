import {
  type Heuristic,
  heuristicLabels,
  heuristics,
  type Severity,
  TASK_LIMITS,
  type TaskResult,
} from '@auditoria-rf/contracts';
import { Pause, Play, Plus, RotateCcw } from 'lucide-react';
import { type FormEvent, useEffect, useId, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router';
import { Badge, Button, Choice, cn, EmptyState, Note, TextField } from '../../components/ui';
import { ApiError } from '../../lib/api';
import { QueryState } from '../results/QueryState';
import { usePortalTasks, useSaveTaskInspection } from './api';
import type { PortalContext } from './context';

const resultLabels: Record<TaskResult, string> = {
  completed: 'Concluída sem dificuldade',
  completed_with_difficulty: 'Concluída com dificuldade',
  interrupted: 'Interrompida — o objetivo não foi alcançado',
};

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

type Task = NonNullable<ReturnType<typeof usePortalTasks>['data']>[number];

/** Formulário de uma tarefa-alvo: cronômetro, interações, caminho, resultado e heurística. */
function TaskForm({
  item,
  onSaved,
  nextLabel,
}: {
  item: Task;
  onSaved: () => void;
  nextLabel: string | null;
}) {
  const { collectionId, institutionId } = useOutletContext<PortalContext>();
  const save = useSaveTaskInspection(collectionId, institutionId);
  const previous = item.inspection;
  const [seconds, setSeconds] = useState(previous?.durationSeconds ?? 0);
  const [running, setRunning] = useState(false);
  const [interactions, setInteractions] = useState(previous?.interactions ?? 0);
  const [depth, setDepth] = useState(previous?.depth ?? 0);
  const [path, setPath] = useState<string[]>(previous?.path ?? []);
  const [step, setStep] = useState('');
  const [result, setResult] = useState<TaskResult | null>(previous?.result ?? null);
  const [heuristic, setHeuristic] = useState<Heuristic | null>(previous?.heuristic ?? null);
  const [severity, setSeverity] = useState<Severity | null>(previous?.severity ?? null);
  const [note, setNote] = useState(previous?.note ?? '');
  const ids = { result: useId(), heuristic: useId(), severity: useId() };

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [running]);

  const limitReached =
    seconds >= TASK_LIMITS.maxSeconds || interactions >= TASK_LIMITS.maxInteractions;
  const needsHeuristic = result !== null && result !== 'completed';

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!result) return;
    setRunning(false);
    save.mutate(
      {
        collectionId,
        institutionId,
        taskId: item.task.id,
        result,
        interactions,
        durationSeconds: seconds,
        depth,
        path,
        heuristic: needsHeuristic ? heuristic : null,
        severity: needsHeuristic ? severity : null,
        note,
      },
      { onSuccess: onSaved },
    );
  };

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-5"
      aria-labelledby={`tarefa-${item.task.id}`}
    >
      <section className="flex flex-col gap-4 rounded-lg bg-surface p-5 shadow-card">
        <p className="text-label text-text-muted">Tarefa</p>
        <h2 id={`tarefa-${item.task.id}`} className="text-section text-text">
          {item.task.description}
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-2 rounded-lg bg-muted p-4">
            <p className="text-label text-text-muted">Tempo decorrido</p>
            <p className="text-metric" aria-live="off">
              {clock(seconds)}
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="min-h-9 px-3"
                onClick={() => setRunning((r) => !r)}
              >
                {running ? (
                  <Pause aria-hidden="true" size={16} strokeWidth={1.75} />
                ) : (
                  <Play aria-hidden="true" size={16} strokeWidth={1.75} />
                )}
                {running ? 'Pausar' : seconds > 0 ? 'Retomar' : 'Iniciar'}
              </Button>
              <Button
                variant="secondary"
                className="min-h-9 px-3"
                aria-label="Zerar cronômetro"
                onClick={() => {
                  setRunning(false);
                  setSeconds(0);
                }}
              >
                <RotateCcw aria-hidden="true" size={16} strokeWidth={1.75} /> Zerar
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-2 rounded-lg bg-muted p-4">
            <p className="text-label text-text-muted">Interações</p>
            <p className="text-metric">{interactions}</p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="min-h-9 px-3"
                aria-label="Registrar uma interação"
                onClick={() => setInteractions((n) => n + 1)}
              >
                +1 clique
              </Button>
              <Button
                variant="secondary"
                className="min-h-9 px-3"
                aria-label="Desfazer uma interação"
                disabled={interactions === 0}
                onClick={() => setInteractions((n) => Math.max(0, n - 1))}
              >
                −1
              </Button>
            </div>
          </div>
          <div className="rounded-lg bg-muted p-4">
            <TextField
              label="Profundidade (níveis a partir do início)"
              type="number"
              min={0}
              max={50}
              value={depth}
              onChange={(e) => setDepth(Math.max(0, Number(e.target.value)))}
            />
          </div>
        </div>
        <p
          role="status"
          className={cn(
            'text-label',
            limitReached ? 'font-medium text-warn-text' : 'text-text-muted',
          )}
        >
          {limitReached
            ? `Limite atingido (${TASK_LIMITS.maxSeconds / 60} min ou ${TASK_LIMITS.maxInteractions} interações): registre a tarefa como interrompida.`
            : `Interromper ao chegar a ${TASK_LIMITS.maxSeconds / 60} minutos ou ${TASK_LIMITS.maxInteractions} interações, o que vier primeiro.`}
        </p>
      </section>

      <section className="flex flex-col gap-3 rounded-lg bg-surface p-5 shadow-card">
        <h3 className="text-card text-text">Caminho percorrido</h3>
        {path.length > 0 ? (
          <ol className="list-decimal space-y-1 pl-6 font-mono text-code">
            {path.map((p, i) => (
              <li key={`${i}-${p}`} className="flex items-center gap-3">
                <span className="flex-1">{p}</span>
                <button
                  type="button"
                  className="min-h-6 text-label text-accent underline"
                  aria-label={`Remover passo ${i + 1}: ${p}`}
                  onClick={() => setPath((list) => list.filter((_, j) => j !== i))}
                >
                  remover
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-body text-text-muted">Nenhum passo registrado.</p>
        )}
        <div className="flex flex-wrap items-end gap-2">
          <TextField
            label="Próximo passo"
            placeholder="Ex.: Institucional"
            value={step}
            onChange={(e) => setStep(e.target.value)}
            className="min-w-64 flex-1"
          />
          <Button
            variant="secondary"
            disabled={step.trim() === ''}
            onClick={() => {
              setPath((list) => [...list, step.trim()]);
              setStep('');
            }}
          >
            <Plus aria-hidden="true" size={16} strokeWidth={1.75} /> Registrar passo
          </Button>
        </div>
      </section>

      <fieldset
        aria-labelledby={ids.result}
        className="flex flex-col gap-1 rounded-lg bg-surface p-5 shadow-card"
      >
        <legend id={ids.result} className="mb-2 text-card text-text">
          Resultado da tarefa
        </legend>
        {(Object.keys(resultLabels) as TaskResult[]).map((key) => (
          <Choice
            key={key}
            type="radio"
            name={`resultado-${item.task.id}`}
            checked={result === key}
            onChange={() => setResult(key)}
            label={resultLabels[key]}
          />
        ))}
      </fieldset>

      {needsHeuristic ? (
        <section className="flex flex-col gap-4 rounded-lg bg-surface p-5 shadow-card">
          <fieldset aria-labelledby={ids.heuristic} className="flex flex-col gap-1">
            <legend id={ids.heuristic} className="mb-2 text-card text-text">
              Heurística violada
            </legend>
            {heuristics.map((h) => (
              <Choice
                key={h}
                type="radio"
                name={`heuristica-${item.task.id}`}
                checked={heuristic === h}
                onChange={() => setHeuristic(h)}
                label={heuristicLabels[h]}
              />
            ))}
          </fieldset>
          <fieldset aria-labelledby={ids.severity} className="flex flex-col gap-1">
            <legend id={ids.severity} className="mb-2 text-card text-text">
              Severidade atribuída
            </legend>
            <Choice
              type="radio"
              name={`severidade-${item.task.id}`}
              checked={severity === 'critical'}
              onChange={() => setSeverity('critical')}
              label="Crítico"
            />
            <Choice
              type="radio"
              name={`severidade-${item.task.id}`}
              checked={severity === 'moderate'}
              onChange={() => setSeverity('moderate')}
              label="Moderado"
            />
          </fieldset>
        </section>
      ) : null}

      <section className="rounded-lg bg-surface p-5 shadow-card">
        <label className="flex flex-col gap-1.5 text-card text-text">
          Observação do avaliador{needsHeuristic ? ' (obrigatória)' : ''}
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="rounded-md border border-border-strong bg-surface px-3 py-2 text-body font-normal"
          />
        </label>
      </section>

      {save.error ? (
        <p role="alert" className="text-body text-critical-text">
          {save.error instanceof ApiError ? save.error.message : 'Não foi possível salvar.'}
        </p>
      ) : null}
      <div>
        <Button
          type="submit"
          disabled={
            !result ||
            (needsHeuristic && (!heuristic || !severity || note.trim().length < 3)) ||
            save.isPending
          }
        >
          {nextLabel ? `Salvar e ir para: ${nextLabel}` : 'Salvar tarefa'}
        </Button>
      </div>
    </form>
  );
}

/** Tela 3.1: tarefas-alvo do portal, uma por vez. */
export function TasksTab() {
  const { collectionId, institutionId } = useOutletContext<PortalContext>();
  const tasks = usePortalTasks(collectionId, institutionId);
  const [params, setParams] = useSearchParams();

  return (
    <QueryState
      query={tasks}
      loadingText="Carregando tarefas…"
      errorTitle="Não foi possível carregar as tarefas"
    >
      {(list) => {
        if (list.length === 0)
          return <EmptyState title="Nenhuma tarefa-alvo para as funções desta coleta" />;
        const requested = Number(params.get('tarefa'));
        const current =
          list.find((t) => t.task.id === requested) ?? list.find((t) => !t.inspection) ?? list[0]!;
        const index = list.indexOf(current);
        const next =
          list.slice(index + 1).find((t) => !t.inspection) ??
          list.find((t) => !t.inspection && t !== current);
        return (
          <div className="flex flex-col gap-6">
            <nav aria-label="Tarefas do portal">
              <ol className="flex flex-wrap gap-2">
                {list.map((t, i) => (
                  <li key={t.task.id}>
                    <button
                      type="button"
                      aria-current={t === current ? 'step' : undefined}
                      onClick={() => setParams({ tarefa: String(t.task.id) })}
                      className={cn(
                        'inline-flex min-h-9 items-center gap-2 rounded-md border px-3 text-label',
                        t === current
                          ? 'border-accent bg-accent-soft font-medium text-accent-text'
                          : 'border-border-strong bg-surface',
                      )}
                    >
                      {i + 1}. {t.task.title}
                      <Badge variant={t.inspection ? 'good' : 'neutral'}>
                        {t.inspection ? 'registrada' : 'pendente'}
                      </Badge>
                    </button>
                  </li>
                ))}
              </ol>
            </nav>
            <TaskForm
              key={current.task.id}
              item={current}
              nextLabel={next ? next.task.title : null}
              onSaved={() => next && setParams({ tarefa: String(next.task.id) })}
            />
            <Note>
              Mesmo enunciado em todas as instituições, para que os resultados sejam comparáveis.
              Interações e profundidade são contadas pelo auditor enquanto executa a tarefa no
              portal, em outra janela.
            </Note>
          </div>
        );
      }}
    </QueryState>
  );
}
