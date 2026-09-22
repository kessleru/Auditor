import { type CreateInstitutionInput, createInstitutionSchema } from '@auditoria-rf/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { useId } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { Badge, Button, DataTable, EmptyState, PageTitle, TextField } from '../../components/ui';
import { ApiError } from '../../lib/api';
import { useCreateInstitution, useInstitutions, useUpdateInstitution } from '../audits/api';
import { QueryState } from '../results/QueryState';

/** Cadastro das instituições auditadas (auditor). */
export function InstitutionsAdminPage() {
  const institutions = useInstitutions();
  const create = useCreateInstitution();
  const update = useUpdateInstitution();
  const formHeading = useId();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateInstitutionInput>({ resolver: zodResolver(createInstitutionSchema) });

  const onSubmit = handleSubmit((values) => create.mutate(values, { onSuccess: () => reset() }));

  return (
    <div className="flex flex-col gap-6">
      <PageTitle>Instituições</PageTitle>

      <QueryState
        query={institutions}
        loadingText="Carregando instituições…"
        errorTitle="Não foi possível carregar as instituições"
      >
        {(rows) =>
          rows.length === 0 ? (
            <EmptyState
              title="Nenhuma instituição cadastrada"
              description="Use o formulário abaixo para cadastrar a primeira."
            />
          ) : (
            <DataTable
              caption="Instituições cadastradas"
              captionHidden
              rows={rows}
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
                    </span>
                  ),
                },
                {
                  key: 'domain',
                  header: 'Domínio',
                  cell: (row) => <span className="font-mono text-code">{row.domain}</span>,
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
                    <span className="flex flex-wrap items-center justify-end gap-3">
                      <Link
                        to={`/auditorias/nova/rotas/${row.id}?instituicoes=${row.id}`}
                        aria-label={`Revisar rotas do ${row.acronym}`}
                        className="text-accent underline underline-offset-2"
                      >
                        Revisar rotas
                      </Link>
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
          )
        }
      </QueryState>

      <section
        aria-labelledby={formHeading}
        className="flex flex-col gap-4 rounded-lg bg-surface p-5 shadow-card"
      >
        <h2 id={formHeading} className="text-section text-text">
          Cadastrar instituição
        </h2>
        {create.error ? (
          <p
            role="alert"
            className="rounded-md bg-critical-soft px-4 py-3 text-body text-critical-text"
          >
            {create.error instanceof ApiError
              ? create.error.message
              : 'Não foi possível cadastrar.'}
          </p>
        ) : null}
        {create.isSuccess ? (
          <p role="status" className="text-body text-ok-text">
            Instituição cadastrada.
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
          <div>
            <Button type="submit" disabled={create.isPending}>
              Cadastrar
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
