import { assistiveCheckTexts, heuristicLabels } from '@auditoria-rf/contracts';
import { Download } from 'lucide-react';
import { useId, useState } from 'react';
import { useParams } from 'react-router';
import {
  Badge,
  buttonClasses,
  cn,
  EmptyState,
  ErrorState,
  FindingCard,
  FindingPreview,
  Page,
  PageHeader,
} from '../../components/ui';
import { formatDate } from '../../lib/format';
import { CSV_PROBLEMS_URL, useAuditorInstitution } from './auditorApi';
import { Breadcrumb } from './Breadcrumb';
import { ConformityHistoryChart } from './ConformityHistoryChart';
import { ConformitySummary } from './ConformitySummary';
import { ReviewNeededNote } from './ReviewNeededNote';
import { ComparisonBasis } from './CoreFunctionsNote';
import { QueryState } from './QueryState';
import { noDataDescription } from './noData';

type Filter = 'all' | 'automated' | 'inspection' | 'critical';

const validationText = {
  confirmed: 'Confirmado',
  pending: 'Validação pendente',
  false_positive: 'Falso positivo',
} as const;
const resultText = {
  completed: 'Tarefa concluída',
  completed_with_difficulty: 'Tarefa concluída com dificuldade',
  interrupted: 'Tarefa interrompida',
} as const;

/** Tela 4.3: detalhe da instituição na visão do auditor (automatizada + inspeção). */
export function AuditorInstitutionPage() {
  const id = Number(useParams().id);
  const detail = useAuditorInstitution(id);
  const [filter, setFilter] = useState<Filter>('all');
  const historyId = useId();

  return (
    <QueryState
      query={detail}
      loadingText="Carregando instituição…"
      errorTitle="Não foi possível carregar a instituição"
    >
      {({ institution, history, problems, manual }) => {
        const cards = [
          ...problems.map((p) => ({
            kind: 'automated' as const,
            critical: p.severity === 'critical',
            key: p.fingerprint,
            p,
          })),
          ...manual.tasks.map((t, i) => ({
            kind: 'task' as const,
            critical: t.severity === 'critical',
            key: `t${i}`,
            t,
          })),
          ...manual.barriers.map((b, i) => ({
            kind: 'barrier' as const,
            critical: b.severity === 'critical',
            key: `b${i}`,
            b,
          })),
        ];
        const inspectionCount = manual.tasks.length + manual.barriers.length;
        const counts: Record<Filter, number> = {
          all: cards.length,
          automated: problems.length,
          inspection: inspectionCount,
          critical: cards.filter((c) => c.critical).length,
        };
        const labels: Record<Filter, string> = {
          all: `Todos os ${counts.all} achados`,
          automated: `Somente automatizada (${counts.automated})`,
          inspection: `Somente inspeção (${counts.inspection})`,
          critical: `Somente críticos (${counts.critical})`,
        };
        const visible = cards.filter(
          (c) =>
            filter === 'all' ||
            (filter === 'automated' && c.kind === 'automated') ||
            (filter === 'inspection' && c.kind !== 'automated') ||
            (filter === 'critical' && c.critical),
        );
        return (
          <Page>
            <PageHeader
              breadcrumb={
                <Breadcrumb
                  items={[{ to: '/painel', label: 'Painel de auditoria' }]}
                  current={institution.acronym}
                />
              }
              title={institution.name}
              meta={[
                { label: 'Portal', value: institution.domain },
                ...(institution.collectedAt
                  ? [{ label: 'Última coleta', value: formatDate(institution.collectedAt) }]
                  : []),
                ...(institution.status === 'evaluated'
                  ? [{ label: 'Páginas avaliadas', value: institution.pagesEvaluated }]
                  : []),
              ]}
              actions={
                <a href={CSV_PROBLEMS_URL} download className={buttonClasses('secondary')}>
                  <Download aria-hidden="true" size={16} strokeWidth={1.75} /> Exportar problemas
                  (CSV)
                </a>
              }
            />

            {institution.status === 'no_data' ? (
              <ErrorState
                title="Sem dado na última coleta"
                description={noDataDescription(institution.noDataReason)}
              />
            ) : null}
            {institution.status === 'not_collected' ? (
              <EmptyState title="Ainda não avaliado" />
            ) : null}

            {institution.status === 'evaluated' ? (
              <ConformitySummary
                conformity={institution.conformity}
                acronym={institution.acronym}
                figures={[
                  {
                    label: 'Problemas',
                    value: institution.problems ?? 0,
                    hint: `${institution.pendingValidation} aguardando validação`,
                  },
                  { label: 'Críticos', value: institution.criticalProblems ?? 0 },
                  { label: 'De template', value: institution.templateProblems ?? 0 },
                  {
                    label: 'Tarefas concluídas',
                    value: institution.tasks
                      ? `${institution.tasks.done} de ${institution.tasks.total}`
                      : '—',
                    ...(institution.inspection === 'not_in_sample' && {
                      hint: 'Fora da subamostra',
                    }),
                  },
                ]}
              />
            ) : null}
            {institution.status === 'evaluated' ? (
              <>
                <ReviewNeededNote count={institution.reviewNeeded} />
                <ComparisonBasis institution={institution} />
              </>
            ) : null}

            {history.length > 0 ? (
              <section
                aria-labelledby={historyId}
                className="flex flex-col gap-4 rounded-lg bg-surface p-5 shadow-card"
              >
                <h2 id={historyId} className="text-section text-text">
                  Evolução da conformidade
                </h2>
                <ConformityHistoryChart entries={history} headingId={historyId} />
              </section>
            ) : null}

            {cards.length > 0 ? (
              <section className="flex flex-col gap-4">
                <h2 className="text-section text-text">Achados</h2>
                <div role="group" aria-label="Filtrar achados" className="flex flex-wrap gap-2">
                  {(Object.keys(labels) as Filter[]).map((key) => (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={filter === key}
                      onClick={() => setFilter(key)}
                      className={cn(
                        'min-h-9 rounded-md border px-3 text-label font-medium transition-colors duration-150',
                        filter === key
                          ? 'border-accent bg-accent text-white'
                          : 'border-border-strong bg-surface text-text hover:bg-muted',
                      )}
                    >
                      {labels[key]}
                    </button>
                  ))}
                </div>
                <p role="status" className="sr-only">
                  {visible.length === 1 ? '1 achado exibido' : `${visible.length} achados exibidos`}
                </p>
                <ul className="flex flex-col gap-4">
                  {visible.map((c) => (
                    <li key={c.key}>
                      {c.kind === 'automated' ? (
                        <FindingCard
                          title={c.p.title}
                          severity={c.p.severity}
                          origin="automated"
                          wcagCriteria={c.p.wcagCriteria}
                          principle={c.p.principle}
                          description={c.p.description}
                          pageUrl={c.p.example.pageUrl}
                          preview={<FindingPreview example={c.p.example} />}
                          snippet={c.p.example.htmlSnippet}
                          template={c.p.template}
                          meta={
                            <>
                              <Badge variant={c.p.validation === 'confirmed' ? 'good' : 'moderate'}>
                                {validationText[c.p.validation]}
                              </Badge>{' '}
                              em {c.p.pages} {c.p.pages === 1 ? 'página' : 'páginas'},{' '}
                              {c.p.occurrences}{' '}
                              {c.p.occurrences === 1 ? 'ocorrência' : 'ocorrências'}
                            </>
                          }
                          recommendation={
                            <a
                              href={c.p.helpUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-accent-text underline underline-offset-2 hover:decoration-2"
                            >
                              como corrigir (documentação do axe, em inglês; abre em nova aba)
                            </a>
                          }
                        />
                      ) : c.kind === 'task' ? (
                        <FindingCard
                          title={`${resultText[c.t.result]}: ${c.t.taskTitle}`}
                          severity={c.t.severity ?? 'moderate'}
                          origin="inspection"
                          reference={c.t.heuristic ? heuristicLabels[c.t.heuristic] : undefined}
                          description={c.t.note}
                          meta={`Tarefa: ${c.t.taskDescription} — ${c.t.interactions} interações em ${Math.round(c.t.durationSeconds / 60)} min`}
                          snippet={
                            c.t.path.length > 0 ? `Caminho: ${c.t.path.join(' › ')}` : undefined
                          }
                          recommendation="rever a nomenclatura e o caminho até a informação para quem não conhece a estrutura interna."
                        />
                      ) : (
                        <FindingCard
                          title={`Barreira: ${assistiveCheckTexts[c.b.kind].title}`}
                          severity={c.b.severity ?? 'moderate'}
                          origin="inspection"
                          reference={assistiveCheckTexts[c.b.kind].nature}
                          description={c.b.note ?? ''}
                          pageUrl={c.b.pageUrl}
                          recommendation={assistiveCheckTexts[c.b.kind].description}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </Page>
        );
      }}
    </QueryState>
  );
}
