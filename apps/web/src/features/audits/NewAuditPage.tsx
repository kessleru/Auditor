import {
  type AuditDraft,
  type Institution,
  type PageFunctionKey,
  pageFunctionKeys,
  pageFunctionLabels,
} from '@auditoria-rf/contracts';
import { type FormEvent, useCallback, useEffect, useId, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import {
  Button,
  ButtonLink,
  Choice,
  EmptyState,
  Page,
  PageHeader,
  Stepper,
} from '../../components/ui';
import { ApiError } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { QueryState } from '../results/QueryState';
import { useAuditDraft, useInstitutions, useRememberDraftPosition, useSaveAuditDraft } from './api';
import { DiscardDraft } from './draftParts';

/** Espera depois da última mudança no formulário antes de salvar o escopo. */
const AUTOSAVE_MS = 600;

/** Onde a auditoria em montagem parou (revisão de rotas: visão geral ou uma instituição). */
export const draftLocation = (draft: AuditDraft) =>
  draft.step === 'routes'
    ? draft.institutionId !== null
      ? `/auditorias/nova/rotas/${draft.institutionId}`
      : '/auditorias/nova/rotas'
    : '/auditorias/nova/escopo';

/**
 * "Nova auditoria" (tela 1.1): com uma auditoria em montagem, volta para a etapa em que o auditor
 * parou (ADR 0017); sem ela, abre o escopo.
 */
export function NewAuditPage() {
  const draft = useAuditDraft();
  if (draft.data && draft.data.step === 'routes') {
    return <Navigate to={draftLocation(draft.data)} replace />;
  }
  return <ScopePage draft={draft} />;
}

/** Escopo sempre, mesmo com a revisão de rotas em andamento ("Voltar ao escopo"). */
export function AuditScopePage() {
  return <ScopePage draft={useAuditDraft()} />;
}

function ScopePage({ draft }: { draft: ReturnType<typeof useAuditDraft> }) {
  const institutions = useInstitutions();
  const saved = draft.data;
  useRememberDraftPosition(saved, { step: 'scope', institutionId: null });
  // Descartar recria o formulário com os padrões. Criar o rascunho (primeira mudança) não recria:
  // o foco fica onde o auditor estava.
  const [generation, setGeneration] = useState(0);
  const [hadDraft, setHadDraft] = useState(Boolean(saved));
  if (hadDraft !== Boolean(saved)) {
    setHadDraft(Boolean(saved));
    if (!saved) setGeneration((g) => g + 1);
  }
  // O formulário recriado leva o botão que tinha o foco: o foco volta para o título da página.
  const headerRef = useRef<HTMLDivElement>(null);
  const focusTitle = useCallback(
    () => requestAnimationFrame(() => headerRef.current?.querySelector('h1')?.focus()),
    [],
  );

  return (
    <Page>
      <div ref={headerRef} className="contents">
        <PageHeader
          title="Nova auditoria"
          breadcrumb={<Stepper current={0} />}
          description={
            saved
              ? `Auditoria em montagem desde ${formatDate(saved.createdAt)}. O que você escolher fica salvo: dá para sair e continuar depois de onde parou.`
              : 'Defina o escopo da coleta. O que você escolher fica salvo: dá para sair e continuar depois de onde parou. A descoberta de rotas e a coleta rodam em segundo plano.'
          }
        />
      </div>

      <QueryState
        query={draft}
        loadingText="Carregando a auditoria em montagem…"
        errorTitle="Não foi possível carregar a auditoria em montagem"
      >
        {() => (
          <QueryState
            query={institutions}
            loadingText="Carregando instituições…"
            errorTitle="Não foi possível carregar as instituições"
          >
            {(all) => {
              const active = all.filter((i) => i.active);
              if (active.length === 0) {
                return (
                  <EmptyState
                    title="Nenhuma instituição ativa"
                    description="Cadastre as instituições que serão auditadas antes de montar o escopo."
                    action={
                      <ButtonLink to="/gestao/instituicoes">Cadastrar instituições</ButtonLink>
                    }
                  />
                );
              }
              return (
                <ScopeForm
                  key={generation}
                  active={active}
                  draft={draft.data ?? null}
                  onDiscarded={focusTitle}
                />
              );
            }}
          </QueryState>
        )}
      </QueryState>
    </Page>
  );
}

function ScopeForm({
  active,
  draft,
  onDiscarded,
}: {
  active: Institution[];
  draft: AuditDraft | null;
  onDiscarded: () => void;
}) {
  const navigate = useNavigate();
  const save = useSaveAuditDraft();
  const errorRef = useRef<HTMLDivElement>(null);
  const initialIds = draft?.scope.institutionIds ?? [];
  const allSelected =
    draft === null || (active.length > 0 && active.every((i) => initialIds.includes(i.id)));
  const [mode, setMode] = useState<'all' | 'some'>(allSelected ? 'all' : 'some');
  const [selected, setSelected] = useState<number[]>(allSelected ? [] : initialIds);
  const [functions, setFunctions] = useState<PageFunctionKey[]>(
    draft ? draft.scope.functions : [...pageFunctionKeys],
  );
  const [errors, setErrors] = useState<string[]>([]);
  const scopeId = useId();
  const functionsId = useId();

  const institutionIds =
    mode === 'all'
      ? active.map((i) => i.id)
      : selected.filter((id) => active.some((i) => i.id === id));
  const ordered = pageFunctionKeys.filter((k) => functions.includes(k));

  // Salvamento automático: cada mudança fica salva no servidor pouco depois; sair da tela antes
  // disso salva na hora. Confirmar o escopo cancela o salvamento pendente.
  const pending = useRef<{ institutionIds: number[]; functions: PageFunctionKey[] } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const { mutate } = save;
  // Mensagem de status do salvamento automático (curta; só depois de cada pausa nas escolhas).
  const [savedNote, setSavedNote] = useState('');
  const flush = useCallback(() => {
    clearTimeout(timer.current);
    if (pending.current) {
      mutate(
        { step: 'scope', ...pending.current },
        { onSuccess: () => setSavedNote('Escopo salvo.') },
      );
    }
    pending.current = null;
  }, [mutate]);
  useEffect(() => () => flush(), [flush]);

  const change = (next: {
    mode?: 'all' | 'some';
    selected?: number[];
    functions?: PageFunctionKey[];
  }) => {
    const nextMode = next.mode ?? mode;
    const nextSelected = next.selected ?? selected;
    const nextFunctions = next.functions ?? functions;
    if (next.mode) setMode(next.mode);
    if (next.selected) setSelected(next.selected);
    if (next.functions) setFunctions(next.functions);
    setSavedNote('');
    pending.current = {
      institutionIds:
        nextMode === 'all'
          ? active.map((i) => i.id)
          : nextSelected.filter((id) => active.some((i) => i.id === id)),
      functions: pageFunctionKeys.filter((k) => nextFunctions.includes(k)),
    };
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, AUTOSAVE_MS);
  };

  const toggle = <T,>(list: T[], value: T) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const problems = [
      ...(institutionIds.length === 0 ? ['Escolha ao menos uma instituição.'] : []),
      ...(functions.length === 0 ? ['Escolha ao menos uma página por instituição.'] : []),
    ];
    setErrors(problems);
    if (problems.length > 0) {
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    clearTimeout(timer.current);
    pending.current = null;
    save.mutate(
      { step: 'routes', institutionIds, functions: ordered },
      { onSuccess: () => void navigate('/auditorias/nova/rotas') },
    );
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      {errors.length > 0 ? (
        <div
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          className="rounded-md border border-critical bg-critical-soft px-4 py-3 text-body text-critical-text"
        >
          <p className="font-medium">Revise o escopo:</p>
          <ul className="list-disc pl-5">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="rounded-lg bg-surface p-5 shadow-card">
        <fieldset aria-labelledby={scopeId} className="flex flex-col gap-2">
          <legend id={scopeId} className="mb-2 text-card text-text">
            Escopo da coleta
          </legend>
          <Choice
            type="radio"
            name="escopo"
            checked={mode === 'all'}
            onChange={() => change({ mode: 'all' })}
            label={`Todas as instituições ativas — ${active.length} ${active.length === 1 ? 'portal' : 'portais'}`}
          />
          <Choice
            type="radio"
            name="escopo"
            checked={mode === 'some'}
            onChange={() => change({ mode: 'some' })}
            label="Escolher instituições"
          />
          {mode === 'some' ? (
            <div role="group" aria-label="Instituições" className="mt-1 ml-8 flex flex-col gap-1">
              {active.map((institution) => (
                <Choice
                  key={institution.id}
                  type="checkbox"
                  checked={selected.includes(institution.id)}
                  onChange={() => change({ selected: toggle(selected, institution.id) })}
                  label={
                    <>
                      <span className="font-medium">{institution.acronym}</span>{' '}
                      <span className="text-text-muted">— {institution.name}</span>
                    </>
                  }
                />
              ))}
            </div>
          ) : null}
        </fieldset>
      </div>

      <div className="rounded-lg bg-surface p-5 shadow-card">
        <fieldset aria-labelledby={functionsId} className="flex flex-col gap-3">
          <legend id={functionsId} className="mb-1 text-card text-text">
            Páginas avaliadas por instituição ({functions.length} de {pageFunctionKeys.length})
          </legend>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              className="min-h-8 px-3"
              disabled={functions.length === pageFunctionKeys.length}
              onClick={() => change({ functions: [...pageFunctionKeys] })}
            >
              Marcar todas
            </Button>
            <Button
              variant="secondary"
              className="min-h-8 px-3"
              disabled={functions.length === 0}
              onClick={() => change({ functions: [] })}
            >
              Desmarcar todas
            </Button>
          </div>
          <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
            {pageFunctionKeys.map((key) => (
              <Choice
                key={key}
                type="checkbox"
                checked={functions.includes(key)}
                onChange={() => change({ functions: toggle(functions, key) })}
                label={pageFunctionLabels[key]}
              />
            ))}
          </div>
        </fieldset>
      </div>

      <p className="text-label text-text-muted">
        A auditoria automatizada cobre só parte da WCAG; qualidade do texto alternativo e coerência
        da navegação ficam para a inspeção manual de cada portal. Ao continuar, a descoberta de
        rotas das instituições ainda não descobertas começa em segundo plano.
      </p>

      <p role="status" className="text-label text-text-muted">
        {savedNote}
      </p>
      {save.error ? (
        <p role="alert" className="text-label text-critical-text">
          {save.error instanceof ApiError
            ? save.error.message
            : 'Não foi possível salvar o escopo. Tente de novo em instantes.'}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={save.isPending}>
          Continuar para a revisão de rotas
        </Button>
        <ButtonLink to="/painel" variant="secondary">
          Voltar ao painel
        </ButtonLink>
      </div>

      {draft ? (
        <DiscardDraft
          onConfirm={() => {
            clearTimeout(timer.current);
            pending.current = null;
          }}
          onDiscarded={onDiscarded}
        />
      ) : null}
    </form>
  );
}
