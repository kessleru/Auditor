import { useDeferredValue, useState } from 'react';
import { Link } from 'react-router';
import { EmptyState, Page, PageHeader, SearchField } from '../../components/ui';
import { usePublicInstitutions } from './api';
import { InstitutionsTable } from './InstitutionsTable';
import { QueryState } from './QueryState';

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/** Lista pública de instituições, com busca por nome ou sigla. */
export function PublicInstitutionsPage() {
  const institutions = usePublicInstitutions();
  const [search, setSearch] = useState('');
  const term = normalize(useDeferredValue(search).trim());

  return (
    <Page>
      <PageHeader
        title="Instituições"
        description={
          <>
            Portais avaliados e a sua coleta mais recente. A conformidade cobre apenas critérios
            verificáveis automaticamente —{' '}
            <Link
              to="/metodologia"
              className="text-accent-text underline underline-offset-2 hover:decoration-2"
            >
              veja a metodologia
            </Link>
            .
          </>
        }
      />

      <div className="flex flex-col gap-4">
        <SearchField
          label="Buscar instituição"
          placeholder="Digite o nome ou a sigla"
          className="max-w-sm"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <QueryState
          query={institutions}
          loadingText="Carregando instituições…"
          errorTitle="Não foi possível carregar as instituições"
        >
          {(rows) => {
            const filtered = term
              ? rows.filter((r) => normalize(`${r.acronym} ${r.name} ${r.domain}`).includes(term))
              : rows;
            return (
              <div className="flex flex-col gap-4">
                <p role="status" className="text-label text-text-muted">
                  {filtered.length === 1 ? '1 instituição' : `${filtered.length} instituições`}
                </p>
                {filtered.length === 0 ? (
                  <EmptyState
                    title="Nenhuma instituição encontrada"
                    description="Tente outro nome ou sigla."
                  />
                ) : (
                  <InstitutionsTable rows={filtered} caption="Instituições avaliadas" />
                )}
              </div>
            );
          }}
        </QueryState>
      </div>
    </Page>
  );
}
