import { pageFunctionLabels, type InspectionProblem } from '@auditoria-rf/contracts';
import { Check } from 'lucide-react';
import { useId, useState } from 'react';
import { useOutletContext } from 'react-router';
import { Badge, Button, Choice, FindingCard, Note } from '../../components/ui';
import { ApiError } from '../../lib/api';
import { QueryState } from '../results/QueryState';
import { useInspectionFindings, useValidateFinding } from './api';
import type { PortalContext } from './context';

const validationBadge = {
  confirmed: { label: 'Confirmado', variant: 'good' },
  false_positive: { label: 'Falso positivo', variant: 'neutral' },
  pending: { label: 'Pendente', variant: 'moderate' },
} as const;

function ProblemCard({
  problem,
  collectionId,
  institutionId,
}: {
  problem: InspectionProblem;
  collectionId: number;
  institutionId: number;
}) {
  const validate = useValidateFinding(collectionId, institutionId);
  const [justifying, setJustifying] = useState(false);
  const [note, setNote] = useState('');
  const noteId = useId();
  const status = validationBadge[problem.validation];

  return (
    <FindingCard
      title={problem.title}
      severity={problem.severity}
      origin="automated"
      wcagCriteria={problem.wcagCriteria}
      principle={problem.principle}
      description={problem.description}
      pageUrl={problem.example.pageUrl}
      snippet={problem.example.htmlSnippet}
      template={problem.template}
      meta={
        <>
          em {problem.pages} {problem.pages === 1 ? 'página' : 'páginas'}, {problem.occurrences}{' '}
          {problem.occurrences === 1 ? 'ocorrência' : 'ocorrências'} · seletor{' '}
          <code className="font-mono text-code break-all">{problem.example.selector}</code>
        </>
      }
      recommendation={
        <a
          href={problem.helpUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent-text underline underline-offset-2 hover:decoration-2"
        >
          como corrigir (documentação do axe, em inglês; abre em nova aba)
        </a>
      }
      actions={
        <div className="flex w-full flex-col gap-2 border-t border-border pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={status.variant}>{status.label}</Badge>
            {problem.validation !== 'false_positive' ? (
              <>
                {problem.validation !== 'confirmed' ? (
                  <Button
                    className="min-h-9"
                    disabled={validate.isPending}
                    aria-label={`Confirmar: ${problem.title} (${problem.example.selector})`}
                    onClick={() =>
                      validate.mutate({ findingId: problem.findingId, validation: 'confirmed' })
                    }
                  >
                    <Check aria-hidden="true" size={16} strokeWidth={1.75} /> Confirmar
                  </Button>
                ) : null}
                <Button
                  variant="secondary"
                  className="min-h-9"
                  aria-expanded={justifying}
                  aria-controls={noteId}
                  aria-label={`Marcar como falso positivo: ${problem.title} (${problem.example.selector})`}
                  onClick={() => setJustifying((j) => !j)}
                >
                  Falso positivo
                </Button>
              </>
            ) : null}
          </div>
          {problem.validationNote ? (
            <p className="text-label text-text-muted">Justificativa: {problem.validationNote}</p>
          ) : null}
          <form
            id={noteId}
            hidden={!justifying || problem.validation === 'false_positive'}
            className="motion-safe:animate-enter flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              validate.mutate({ findingId: problem.findingId, validation: 'false_positive', note });
            }}
          >
            <label className="flex flex-col gap-1.5 text-label font-medium">
              Justificativa (obrigatória; o falso positivo fica registrado e não pode ser desfeito)
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className="rounded-md border border-border-strong bg-surface px-3 py-2 font-normal"
              />
            </label>
            <div>
              <Button
                type="submit"
                variant="secondary"
                disabled={note.trim().length < 10 || validate.isPending}
              >
                Registrar falso positivo
              </Button>
            </div>
          </form>
          {validate.error ? (
            <p role="alert" className="text-label text-critical-text">
              {validate.error instanceof ApiError
                ? validate.error.message
                : 'Não foi possível salvar.'}
            </p>
          ) : null}
        </div>
      }
    />
  );
}

/** Tela 3.3: validação dos achados automatizados, agrupados por página (template primeiro). */
export function ValidationTab() {
  const { collectionId, institutionId } = useOutletContext<PortalContext>();
  const findings = useInspectionFindings(collectionId, institutionId);
  const [onlyPending, setOnlyPending] = useState(false);
  return (
    <div className="flex flex-col gap-6">
      <QueryState
        query={findings}
        loadingText="Carregando achados…"
        errorTitle="Não foi possível carregar os achados"
      >
        {({ counts, groups }) => (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface p-5 shadow-card">
              <div className="flex min-w-0 flex-1 basis-64 flex-col gap-2">
                <p className="text-card text-text">
                  {counts.problems - counts.pending} de {counts.problems}{' '}
                  {counts.problems === 1 ? 'problema validado' : 'problemas validados'}
                </p>
                <p className="text-label text-text-muted">
                  {counts.confirmed} {counts.confirmed === 1 ? 'confirmado' : 'confirmados'} ·{' '}
                  {counts.falsePositive}{' '}
                  {counts.falsePositive === 1 ? 'falso positivo' : 'falsos positivos'} ·{' '}
                  {counts.pending} {counts.pending === 1 ? 'pendente' : 'pendentes'}
                </p>
              </div>
              <div className="flex flex-col items-start gap-1">
                <Choice
                  type="checkbox"
                  checked={onlyPending}
                  onChange={(e) => setOnlyPending(e.target.checked)}
                  label="Mostrar só os pendentes"
                />
                <p className="text-label text-text-muted" aria-live="polite">
                  {onlyPending
                    ? `${counts.pending} de ${counts.problems} problemas exibidos`
                    : `${counts.problems} ${counts.problems === 1 ? 'problema exibido' : 'problemas exibidos'}`}
                </p>
              </div>
            </div>
            {onlyPending && counts.pending === 0 ? (
              <p className="text-body text-text-muted">
                Nenhum problema pendente: a validação deste portal está concluída.
              </p>
            ) : null}
            {groups.map((group) => {
              const problems = onlyPending
                ? group.problems.filter((p) => p.validation === 'pending')
                : group.problems;
              if (problems.length === 0) return null;
              const title =
                group.kind === 'template'
                  ? 'Em todas as páginas (template)'
                  : `${group.page?.functionKey ? pageFunctionLabels[group.page.functionKey] : 'Página'}`;
              return (
                <section key={group.page?.id ?? 'template'} className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <h2 className="flex flex-wrap items-center gap-2 text-section text-text">
                      {title}
                      <Badge variant="neutral">
                        {problems.length} {problems.length === 1 ? 'problema' : 'problemas'}
                      </Badge>
                    </h2>
                    {group.page ? (
                      <p className="font-mono text-code break-all text-text-muted">
                        {group.page.url}
                      </p>
                    ) : null}
                  </div>
                  {group.kind === 'template' ? (
                    <p className="text-body text-text-muted">
                      Problemas do cabeçalho e do rodapé, repetidos em quase todas as páginas.
                      Corrigir uma vez resolve o portal inteiro.
                    </p>
                  ) : null}
                  <ul className="flex flex-col gap-5">
                    {problems.map((p) => (
                      <li key={p.fingerprint}>
                        <ProblemCard
                          problem={p}
                          collectionId={collectionId}
                          institutionId={institutionId}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
            <Note title="Por que registrar os falsos positivos">
              A taxa de confirmação dos achados automatizados é resultado da pesquisa: ela mede o
              quanto a ferramenta pode ser usada sem revisão humana. Descartar silenciosamente um
              falso positivo perderia esse dado. A validação vale para o problema inteiro, em todas
              as páginas em que ele aparece.
            </Note>
          </>
        )}
      </QueryState>
    </div>
  );
}
