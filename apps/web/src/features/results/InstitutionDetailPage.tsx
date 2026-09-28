import type { PublicProblem } from '@auditoria-rf/contracts';
import { useId, useState } from 'react';
import { useParams } from 'react-router';
import {
  cn,
  EmptyState,
  ErrorState,
  FindingCard,
  FindingPreview,
  Page,
  PageHeader,
} from '../../components/ui';
import { formatDate } from '../../lib/format';
import { usePublicFindings, usePublicInstitution } from './api';
import { Breadcrumb } from './Breadcrumb';
import { ConformityHistoryChart } from './ConformityHistoryChart';
import { ConformitySummary } from './ConformitySummary';
import { ComparisonBasis } from './CoreFunctionsNote';
import { QueryState } from './QueryState';

type Filter = 'all' | 'critical' | 'template';

const principleText = (problem: PublicProblem) =>
  `em ${problem.pages} ${problem.pages === 1 ? 'página' : 'páginas'}, ${problem.occurrences} ${
    problem.occurrences === 1 ? 'ocorrência' : 'ocorrências'
  }`;

function Problems({ institutionId }: { institutionId: number }) {
  const findings = usePublicFindings(institutionId);
  const [filter, setFilter] = useState<Filter>('all');
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <h2 id={headingId} className="text-section text-text">
        Problemas confirmados
      </h2>
      <QueryState
        query={findings}
        loadingText="Carregando problemas…"
        errorTitle="Não foi possível carregar os problemas"
      >
        {(problems) => {
          if (problems.length === 0) {
            return (
              <EmptyState
                headingLevel={3}
                title="Nenhum problema confirmado"
                description="Os achados automatizados aparecem aqui depois de confirmados na validação manual."
              />
            );
          }
          const counts: Record<Filter, number> = {
            all: problems.length,
            critical: problems.filter((p) => p.severity === 'critical').length,
            template: problems.filter((p) => p.template).length,
          };
          const labels: Record<Filter, string> = {
            all: `Todos (${counts.all})`,
            critical: `Somente críticos (${counts.critical})`,
            template: `Somente de template (${counts.template})`,
          };
          const visible = problems.filter(
            (p) =>
              filter === 'all' || (filter === 'critical' ? p.severity === 'critical' : p.template),
          );
          return (
            <>
              <div role="group" aria-label="Filtrar problemas" className="flex flex-wrap gap-2">
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
                {visible.length === 1
                  ? '1 problema exibido'
                  : `${visible.length} problemas exibidos`}
              </p>
              <ul className="flex flex-col gap-4">
                {visible.map((problem) => (
                  <li key={problem.fingerprint}>
                    <FindingCard
                      title={problem.title}
                      severity={problem.severity}
                      origin="automated"
                      wcagCriteria={problem.wcagCriteria}
                      principle={problem.principle}
                      description={problem.description}
                      pageUrl={problem.example.pageUrl}
                      preview={<FindingPreview example={problem.example} />}
                      snippet={problem.example.htmlSnippet}
                      template={problem.template}
                      meta={principleText(problem)}
                      recommendation={
                        <a
                          href={problem.helpUrl}
                          className="text-accent-text underline underline-offset-2 hover:decoration-2"
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          como corrigir (documentação do axe, em inglês; abre em nova aba)
                        </a>
                      }
                    />
                  </li>
                ))}
              </ul>
            </>
          );
        }}
      </QueryState>
    </section>
  );
}

/** Tela 4.3 em modo leitura, para o visitante. */
export function InstitutionDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  const detail = usePublicInstitution(id);
  const historyId = useId();

  return (
    <QueryState
      query={detail}
      loadingText="Carregando instituição…"
      errorTitle="Não foi possível carregar a instituição"
    >
      {({ institution, history }) => (
        <Page>
          <PageHeader
            breadcrumb={
              <Breadcrumb
                items={[{ to: '/', label: 'Resultados' }]}
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
          />

          {institution.status === 'not_collected' ? (
            <EmptyState
              title="Ainda não avaliado"
              description="Este portal ainda não passou por uma coleta."
            />
          ) : null}

          {institution.status === 'no_data' ? (
            <ErrorState
              title="Sem dado na última coleta"
              description="Nenhuma página do portal pôde ser avaliada na coleta mais recente. Isso é registrado como ausência de dado: o portal não recebe nota e fica fora das médias."
            />
          ) : null}

          {institution.status === 'evaluated' ? (
            <div className="flex flex-col gap-4">
              <ConformitySummary
                conformity={institution.conformity}
                acronym={institution.acronym}
                figures={[
                  { label: 'Problemas confirmados', value: institution.problems ?? 0 },
                  { label: 'Críticos', value: institution.criticalProblems ?? 0 },
                  { label: 'De template', value: institution.templateProblems ?? 0 },
                  {
                    label: 'Aguardando validação',
                    value: institution.pendingValidation,
                    hint: 'Ainda fora da lista de problemas',
                  },
                ]}
              />
              <ComparisonBasis institution={institution} />
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

          {institution.status === 'evaluated' ? <Problems institutionId={institution.id} /> : null}
        </Page>
      )}
    </QueryState>
  );
}
