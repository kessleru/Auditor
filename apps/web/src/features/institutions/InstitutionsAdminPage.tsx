import {
  type CreateInstitutionInput,
  createInstitutionSchema,
  type Institution,
} from '@auditoria-rf/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { useDeferredValue, useEffect, useId, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  Page,
  PageHeader,
  SearchField,
  TextField,
} from '../../components/ui';
import { ApiError } from '../../lib/api';
import { useCreateInstitution, useInstitutions, useUpdateInstitution } from '../audits/api';
import { QueryState } from '../results/QueryState';

const fold = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/**
 * Cadastro e edição no mesmo formulário. Editar serve sobretudo para corrigir o domínio de uma
 * instituição da Rede Federal que mudou de endereço.
 */
function InstitutionForm({ editing, onDone }: { editing: Institution | null; onDone: () => void }) {
  const create = useCreateInstitution();
  const update = useUpdateInstitution();
  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateInstitutionInput>({ resolver: zodResolver(createInstitutionSchema) });

  // Ao abrir (ou trocar a instituição em edição), preenche o formulário e leva o foco até ele.
  useEffect(() => {
    reset(
      editing
        ? { name: editing.name, acronym: editing.acronym, domain: editing.domain }
        : { name: '', acronym: '', domain: '' },
    );
    headingRef.current?.focus();
  }, [editing, reset]);

  const mutation = editing ? update : create;
  const onSubmit = handleSubmit((values) => {
    if (editing) update.mutate({ id: editing.id, ...values }, { onSuccess: onDone });
    else create.mutate(values, { onSuccess: onDone });
  });

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-4 rounded-lg bg-surface p-5 shadow-card"
    >
      <h2 id={headingId} ref={headingRef} tabIndex={-1} className="text-card text-text">
        {editing ? `Editar ${editing.acronym}` : 'Cadastrar instituição'}
      </h2>
      {mutation.error ? (
        <p
          role="alert"
          className="rounded-md bg-critical-soft px-4 py-3 text-body text-critical-text"
        >
          {mutation.error instanceof ApiError ? mutation.error.message : 'Não foi possível salvar.'}
        </p>
      ) : null}
      <form onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-3">
        <TextField label="Nome" error={errors.name?.message} {...register('name')} />
        <TextField label="Sigla" error={errors.acronym?.message} {...register('acronym')} />
        <TextField
          label="Domínio"
          hint="Ex.: iftm.edu.br"
          error={errors.domain?.message}
          {...register('domain')}
        />
        <div className="flex flex-wrap gap-3 sm:col-span-3">
          <Button type="submit" disabled={mutation.isPending}>
            {editing ? 'Salvar alterações' : 'Cadastrar'}
          </Button>
          <Button variant="secondary" onClick={onDone}>
            Cancelar
          </Button>
        </div>
      </form>
    </section>
  );
}

/** Cadastro das instituições auditadas (auditor). */
export function InstitutionsAdminPage() {
  const institutions = useInstitutions();
  const update = useUpdateInstitution();
  // `null` = formulário fechado; 'new' = cadastro; uma instituição = edição.
  const [form, setForm] = useState<'new' | Institution | null>(null);
  const [search, setSearch] = useState('');
  const [saved, setSaved] = useState('');
  const term = fold(useDeferredValue(search).trim());
  const openButtonRef = useRef<HTMLButtonElement>(null);

  const close = (message = '') => {
    setForm(null);
    setSaved(message);
    requestAnimationFrame(() => openButtonRef.current?.focus());
  };

  return (
    <Page>
      <PageHeader
        title="Instituições"
        description="Portais cadastrados para auditoria. Só instituições ativas entram numa nova coleta."
        actions={
          <Button
            ref={openButtonRef}
            variant="secondary"
            aria-expanded={form === 'new'}
            onClick={() => setForm((f) => (f === 'new' ? null : 'new'))}
          >
            Cadastrar instituição
          </Button>
        }
      />

      <p role="status" className="text-body text-ok-text">
        {saved}
      </p>

      {form !== null ? (
        <InstitutionForm
          editing={form === 'new' ? null : form}
          onDone={() => close(form === 'new' ? 'Instituição cadastrada.' : 'Alterações salvas.')}
        />
      ) : null}

      <QueryState
        query={institutions}
        loadingText="Carregando instituições…"
        errorTitle="Não foi possível carregar as instituições"
      >
        {(rows) => {
          if (rows.length === 0) {
            return (
              <EmptyState
                title="Nenhuma instituição cadastrada"
                description="Use “Cadastrar instituição” para incluir a primeira, ou rode npm run db:seed para a Rede Federal."
              />
            );
          }
          const filtered = term
            ? rows.filter((r) => fold(`${r.acronym} ${r.name} ${r.domain}`).includes(term))
            : rows;
          return (
            <div className="flex flex-col gap-3">
              <SearchField
                label="Buscar instituição"
                placeholder="Sigla, nome ou domínio"
                className="max-w-sm"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <p role="status" className="text-label text-text-muted">
                {filtered.length === rows.length
                  ? `${rows.length} instituições`
                  : `${filtered.length} de ${rows.length} instituições`}
              </p>
              {filtered.length === 0 ? (
                <EmptyState
                  title="Nenhuma instituição encontrada"
                  description="Tente outra busca."
                />
              ) : (
                <DataTable
                  caption="Instituições cadastradas"
                  captionHidden
                  rows={filtered}
                  rowKey={(row) => row.id}
                  columns={[
                    {
                      key: 'name',
                      header: 'Instituição',
                      rowHeader: true,
                      cell: (row) => (
                        <span className="flex flex-col">
                          <span className="font-medium">{row.acronym}</span>
                          <span className="text-label text-text-muted">{row.name}</span>
                          <span className="font-mono text-code break-all text-text-muted">
                            {row.domain}
                          </span>
                        </span>
                      ),
                    },
                    {
                      key: 'status',
                      header: 'Situação',
                      cell: (row) => (
                        <Badge variant={row.active ? 'good' : 'neutral'}>
                          {row.active ? 'Ativa' : 'Inativa'}
                        </Badge>
                      ),
                    },
                    {
                      key: 'actions',
                      header: 'Ações',
                      align: 'end',
                      cell: (row) => (
                        <span className="flex flex-wrap items-center justify-end gap-2">
                          <Link
                            to={`/auditorias/nova/rotas/${row.id}?instituicoes=${row.id}`}
                            aria-label={`Revisar rotas do ${row.acronym}`}
                            className="min-h-6 font-medium text-accent-text underline-offset-2 hover:underline"
                          >
                            Revisar rotas
                          </Link>
                          <Button
                            variant="secondary"
                            className="min-h-8 px-3"
                            aria-label={`Editar ${row.acronym}`}
                            onClick={() => setForm(row)}
                          >
                            Editar
                          </Button>
                          <Button
                            variant="secondary"
                            className="min-h-8 px-3"
                            disabled={update.isPending}
                            aria-label={`${row.active ? 'Desativar' : 'Ativar'} ${row.acronym}`}
                            onClick={() => update.mutate({ id: row.id, active: !row.active })}
                          >
                            {row.active ? 'Desativar' : 'Ativar'}
                          </Button>
                        </span>
                      ),
                    },
                  ]}
                />
              )}
            </div>
          );
        }}
      </QueryState>
    </Page>
  );
}
