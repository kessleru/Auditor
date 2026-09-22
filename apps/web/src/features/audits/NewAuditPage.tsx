import {
  type PageFunctionKey,
  pageFunctionKeys,
  pageFunctionLabels,
} from '@auditoria-rf/contracts';
import { type FormEvent, useId, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import {
  Button,
  ButtonLink,
  Choice,
  EmptyState,
  Note,
  Page,
  PageHeader,
  Stepper,
} from '../../components/ui';
import { QueryState } from '../results/QueryState';
import { useInstitutions } from './api';
import { parseScope, scopeSearch } from './scope';

/** Tela 1.1: escopo da auditoria (instituições e funções de página). */
export function NewAuditPage() {
  const institutions = useInstitutions();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initial = parseScope(searchParams);
  const errorRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<'all' | 'some'>(
    initial.institutionIds.length > 0 ? 'some' : 'all',
  );
  const [selected, setSelected] = useState<number[]>(initial.institutionIds);
  const [functions, setFunctions] = useState<PageFunctionKey[]>(
    initial.functions.length > 0 ? initial.functions : [...pageFunctionKeys],
  );
  const [errors, setErrors] = useState<string[]>([]);
  const scopeId = useId();
  const functionsId = useId();

  const toggle = <T,>(list: T[], value: T) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  return (
    <Page>
      <PageHeader
        title="Nova auditoria"
        breadcrumb={<Stepper current={0} />}
        description="Defina o escopo da coleta. Depois você confirma as rotas de cada instituição e pode acompanhar o progresso sem ficar na tela."
      />

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
                action={<ButtonLink to="/gestao/instituicoes">Cadastrar instituições</ButtonLink>}
              />
            );
          }

          const submit = (event: FormEvent) => {
            event.preventDefault();
            const institutionIds =
              mode === 'all'
                ? active.map((i) => i.id)
                : selected.filter((id) => active.some((i) => i.id === id));
            const problems = [
              ...(institutionIds.length === 0 ? ['Escolha ao menos uma instituição.'] : []),
              ...(functions.length === 0 ? ['Escolha ao menos uma página por instituição.'] : []),
            ];
            setErrors(problems);
            if (problems.length > 0) {
              requestAnimationFrame(() => errorRef.current?.focus());
              return;
            }
            const ordered = pageFunctionKeys.filter((k) => functions.includes(k));
            void navigate(
              `/auditorias/nova/rotas${scopeSearch({ institutionIds, functions: ordered })}`,
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
                    onChange={() => setMode('all')}
                    label={`Todas as instituições ativas — ${active.length} ${active.length === 1 ? 'portal' : 'portais'}`}
                  />
                  <Choice
                    type="radio"
                    name="escopo"
                    checked={mode === 'some'}
                    onChange={() => setMode('some')}
                    label="Escolher instituições"
                  />
                  {mode === 'some' ? (
                    <div
                      role="group"
                      aria-label="Instituições"
                      className="mt-1 ml-8 flex flex-col gap-1"
                    >
                      {active.map((institution) => (
                        <Choice
                          key={institution.id}
                          type="checkbox"
                          checked={selected.includes(institution.id)}
                          onChange={() => setSelected((s) => toggle(s, institution.id))}
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
                <fieldset aria-labelledby={functionsId} className="flex flex-col gap-2">
                  <legend id={functionsId} className="mb-2 text-card text-text">
                    Páginas avaliadas por instituição
                  </legend>
                  {pageFunctionKeys.map((key) => (
                    <Choice
                      key={key}
                      type="checkbox"
                      checked={functions.includes(key)}
                      onChange={() => setFunctions((f) => toggle(f, key))}
                      label={pageFunctionLabels[key]}
                    />
                  ))}
                </fieldset>
              </div>

              <Note title="O que esta etapa não cobre">
                A auditoria automatizada verifica apenas parte dos critérios da WCAG. Critérios
                semânticos — qualidade do texto alternativo, coerência da navegação — dependem da
                inspeção manual, registrada depois para cada portal.
              </Note>

              <div className="flex flex-wrap gap-3">
                <Button type="submit">Continuar para a revisão de rotas</Button>
                <ButtonLink to="/painel" variant="secondary">
                  Cancelar
                </ButtonLink>
              </div>
            </form>
          );
        }}
      </QueryState>
    </Page>
  );
}
