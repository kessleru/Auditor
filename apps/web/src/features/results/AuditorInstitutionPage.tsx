import { assistiveCheckTexts, heuristicLabels } from '@auditoria-rf/contracts';
import { Download } from 'lucide-react';
import { useId, useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  Badge,
  buttonClasses,
  cn,
  conformityLabel,
  EmptyState,
  ErrorState,
  FindingCard,
  formatPercent,
  PageTitle,
  StatCard,
} from '../../components/ui';
import { formatDate, formatNumber } from '../../lib/format';
import { CSV_PROBLEMS_URL, useAuditorInstitution } from './auditorApi';
import { ConformityHistoryChart } from './ConformityHistoryChart';
import { QueryState } from './QueryState';

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
          <div className="flex flex-col gap-6">
            <nav aria-label="Trilha de navegação">
              <ol className="flex flex-wrap items-center gap-2 text-label">
                <li>
                  <Link to="/painel" className="text-accent underline underline-offset-2">
                    Painel de auditoria
                  </Link>
                </li>
                <li aria-hidden="true" className="text-text-muted">
                  ›
                </li>
                <li aria-current="page">{institution.acronym}</li>
              </ol>
            </nav>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex flex-col gap-1">
                <PageTitle>{institution.name}</PageTitle>
                <p className="text-label text-text-muted">
                  {institution.domain}
                  {institution.collectedAt
                    ? ` · última coleta em ${formatDate(institution.collectedAt)}`
                    : ''}
                  {institution.status === 'evaluated'
                    ? ` · ${institution.pagesEvaluated} páginas avaliadas`
                    : ''}
                </p>
              </div>
              <a href={CSV_PROBLEMS_URL} download className={buttonClasses('secondary')}>
                <Download aria-hidden="true" size={16} strokeWidth={1.75} /> Exportar problemas
                (CSV)
              </a>
            </div>

            {institution.status === 'no_data' ? (
              <ErrorState
                title="Sem dado na última coleta"
                description="Nenhuma página pôde ser avaliada: ausência de dado, fora das médias."
              />
            ) : null}
            {institution.status === 'not_collected' ? (
              <EmptyState title="Ainda não avaliado" />
            ) : null}

            {institution.status === 'evaluated' ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  label="Conformidade"
                  value={
                    institution.conformity === null
                      ? 'Sem dado'
                      : `${formatPercent(institution.conformity)} — ${conformityLabel(institution.conformity)}`
                  }
                  hint={
                    <Link to="/metodologia" className="text-accent underline underline-offset-2">
                      Só critérios automatizáveis
                    </Link>
                  }
                />
                <StatCard
                  label="Problemas"
                  value={formatNumber(institution.problems ?? 0)}
                  hint={`${institution.pendingValidation} achados com validação pendente`}
                />
                <StatCard
                  label="Críticos"
                  value={formatNumber(institution.criticalProblems ?? 0)}
                />
                <StatCard
                  label="Tarefas concluídas"
                  value={
                    institution.tasks
                      ? `${institution.tasks.done} de ${institution.tasks.total}`
                      : '—'
                  }
                  hint={
                    institution.inspection === 'not_in_sample'
                      ? 'Fora da subamostra da inspeção'
                      : undefined
                  }
                />
              </div>
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
                          snippet={c.p.example.htmlSnippet}
                          template={c.p.template}
                          meta={
                            <>
                              <Badge variant={c.p.validation === 'confirmed' ? 'good' : 'moderate'}>
                                {validationText[c.p.validation]}
                              </Badge>{' '}
                              em {c.p.pages} {c.p.pages === 1 ? 'página' : 'páginas'} ·{' '}
                              {c.p.occurrences}{' '}
                              {c.p.occurrences === 1 ? 'ocorrência' : 'ocorrências'}
                            </>
                          }
                          recommendation={
                            <a
                              href={c.p.helpUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-accent underline underline-offset-2"
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
                          meta={`Tarefa: ${c.t.taskDescription} · ${c.t.interactions} interações · ${Math.round(c.t.durationSeconds / 60)} min`}
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
          </div>
        );
      }}
    </QueryState>
  );
}
