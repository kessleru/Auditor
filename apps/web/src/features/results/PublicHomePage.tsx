import { Link } from 'react-router';
import { Download } from 'lucide-react';
import { buttonClasses, EmptyState, Note, PageTitle } from '../../components/ui';
import { formatDate } from '../../lib/format';
import { usePublicInstitutions, usePublicSummary } from './api';
import { CSV_DICTIONARY_URL, CSV_URL } from './auditorApi';
import { InstitutionsTable } from './InstitutionsTable';
import { QueryState } from './QueryState';

/** Tela 0.2: visão pública dos resultados. */
export function PublicHomePage() {
  const summary = usePublicSummary();
  const institutions = usePublicInstitutions();

  return (
    <div className="flex flex-col gap-6">
      <Note>
        Dados públicos, em modo de consulta. Registrar auditorias e inspeções exige entrar como
        auditor.
      </Note>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <PageTitle documentTitle="Resultados">
            Acessibilidade dos portais da Rede Federal
          </PageTitle>
          {summary.data ? (
            <p className="text-label text-text-muted">
              {summary.data.lastCollectionAt
                ? `Última coleta: ${formatDate(summary.data.lastCollectionAt)}`
                : 'Nenhuma coleta publicada ainda'}{' '}
              · {summary.data.institutionsEvaluated} de {summary.data.institutionsTotal} portais
              avaliados · dados abertos
            </p>
          ) : null}
        </div>
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
      </div>

      <QueryState
        query={institutions}
        loadingText="Carregando resultados…"
        errorTitle="Não foi possível carregar os resultados"
      >
        {(rows) =>
          rows.length === 0 ? (
            <EmptyState
              title="Nenhum resultado publicado"
              description="Os resultados aparecem aqui depois da primeira coleta."
            />
          ) : (
            <InstitutionsTable
              rows={rows}
              caption="Conformidade e problemas confirmados por instituição"
            />
          )
        }
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
    </div>
  );
}
