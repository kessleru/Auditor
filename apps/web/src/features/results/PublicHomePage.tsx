import { Link } from 'react-router';
import { Download } from 'lucide-react';
import { buttonClasses, EmptyState, Note, Page, PageHeader } from '../../components/ui';
import { formatDate } from '../../lib/format';
import { usePublicCoreFunctions, usePublicInstitutions, usePublicSummary } from './api';
import { CSV_DICTIONARY_URL, CSV_URL } from './auditorApi';
import { ConformitySummary } from './ConformitySummary';
import { CoreFunctionsNote } from './CoreFunctionsNote';
import { InstitutionsTable } from './InstitutionsTable';
import { QueryState } from './QueryState';

/** Tela 0.2: visão pública dos resultados. */
export function PublicHomePage() {
  const summary = usePublicSummary();
  const institutions = usePublicInstitutions();
  const coreFunctions = usePublicCoreFunctions();

  return (
    <Page>
      <PageHeader
        title="Acessibilidade dos portais da Rede Federal"
        documentTitle="Resultados"
        description="Resultados em modo de consulta. Registrar auditorias e inspeções exige entrar como auditor."
        actions={
          <div className="flex flex-col items-end gap-1">
            <a href={CSV_URL} download className={buttonClasses('secondary')}>
              <Download aria-hidden="true" size={16} strokeWidth={1.75} /> Baixar dados (CSV)
            </a>
            <a
              href={CSV_DICTIONARY_URL}
              download
              className="inline-flex min-h-6 items-center text-label text-accent-text underline underline-offset-2 hover:decoration-2"
            >
              Dicionário de dados
            </a>
          </div>
        }
      />

      <QueryState
        query={institutions}
        loadingText="Carregando resultados…"
        errorTitle="Não foi possível carregar os resultados"
      >
        {(rows) => {
          // Quantos portais têm dado válido é decisão da API (portal que falhou é ausência de
          // dado, seção 3.2.8), não uma conta feita aqui.
          const evaluated = summary.data?.institutionsEvaluated ?? 0;
          const total = summary.data?.institutionsTotal ?? rows.length;
          const problems = rows.reduce((sum, row) => sum + (row.problems ?? 0), 0);
          return rows.length === 0 ? (
            <EmptyState
              title="Nenhum resultado publicado"
              description="Os resultados aparecem aqui depois da primeira coleta."
            />
          ) : (
            <div className="flex flex-col gap-6">
              <ConformitySummary
                conformity={summary.data?.averageConformity ?? null}
                acronym="Rede Federal"
                label="Resumo da Rede Federal"
                gaugeLabel="Conformidade média dos portais avaliados"
                figures={[
                  {
                    label: 'Portais avaliados',
                    value: `${evaluated} de ${total}`,
                    hint: evaluated < total ? 'os demais ficam fora da média' : '',
                  },
                  {
                    label: 'Problemas confirmados',
                    value: problems,
                    hint: 'problemas distintos, somados',
                  },
                  {
                    label: 'Última coleta',
                    value: summary.data?.lastCollectionAt
                      ? formatDate(summary.data.lastCollectionAt)
                      : '—',
                  },
                ]}
              />
              <div className="flex flex-col gap-2">
                {coreFunctions.data ? (
                  <CoreFunctionsNote coreFunctions={coreFunctions.data} />
                ) : null}
                <InstitutionsTable
                  rows={rows}
                  caption="Conformidade e problemas confirmados por instituição"
                />
              </div>
            </div>
          );
        }}
      </QueryState>

      <Note tone="surface" title="Finalidade dos dados">
        Os resultados são publicados para apoiar a correção dos portais. A conformidade considera
        apenas os critérios verificáveis de forma automatizada e não atesta conformidade integral
        com a WCAG 2.2. Problemas contam só depois de confirmados na validação manual.{' '}
        <Link
          to="/metodologia"
          className="text-accent-text underline underline-offset-2 hover:decoration-2"
        >
          Entenda a metodologia
        </Link>
        .
      </Note>
    </Page>
  );
}
