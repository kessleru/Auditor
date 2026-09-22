import { ArrowLeft, ArrowRight } from 'lucide-react';
import { type FormEvent, useId, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate, useParams } from 'react-router';
import { Badge, Button, cn, ErrorState, PageTitle } from '../../components/ui';
import { formatDate } from '../../lib/format';
import { useInspectionSummary } from './api';

export const TABS = [
  { path: 'validacao', label: 'Validação de achados' },
  { path: 'tarefas', label: 'Tarefas-alvo' },
  { path: 'verificacao', label: 'Verificação assistiva' },
] as const;

export type TabPath = (typeof TABS)[number]['path'];

/**
 * Página de um portal em inspeção: contexto fixo (nome, domínio, data, "Portal N de M",
 * anterior/próximo, troca por `<select>` rotulado) e as três atividades como abas-link.
 */
export function PortalLayout() {
  const params = useParams();
  const collectionId = Number(params.collectionId);
  const institutionId = Number(params.institutionId);
  const tab = (params.tab ?? 'validacao') as TabPath;
  const summary = useInspectionSummary(collectionId);
  const navigate = useNavigate();
  const selectId = useId();
  const [choice, setChoice] = useState<number>(institutionId);

  if (summary.isPending) {
    return (
      <p role="status" className="text-body text-text-muted">
        Carregando portal…
      </p>
    );
  }
  if (summary.isError)
    return (
      <ErrorState title="Não foi possível carregar o portal" description={summary.error.message} />
    );

  const { sample, collection } = summary.data;
  const index = sample.findIndex((p) => p.institutionId === institutionId);
  const portal = sample[index];
  if (!portal) {
    return (
      <ErrorState
        title="Portal fora da subamostra"
        description={
          <Link to={`/inspecao/${collectionId}`} className="text-accent-text underline">
            Voltar à inspeção manual
          </Link>
        }
      />
    );
  }
  const prev = sample[index - 1];
  const next = sample[index + 1];
  const tabLabel = TABS.find((t) => t.path === tab)?.label ?? '';
  const counts: Record<TabPath, string> = {
    validacao:
      portal.findings.pending === 0
        ? 'concluída'
        : `${portal.findings.pending} ${portal.findings.pending === 1 ? 'pendente' : 'pendentes'}`,
    tarefas: `${portal.tasks.done} de ${portal.tasks.total}`,
    verificacao: `${portal.assistive.done} de ${portal.assistive.total} páginas`,
  };
  const go = (e: FormEvent) => {
    e.preventDefault();
    void navigate(`/inspecao/${collectionId}/${choice}/${tab}`);
  };

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Trilha de navegação">
        <ol className="flex flex-wrap items-center gap-2 text-label">
          <li>
            <Link
              to={`/inspecao/${collectionId}`}
              className="text-accent-text underline underline-offset-2 hover:decoration-2"
            >
              Inspeção manual
            </Link>
          </li>
          <li aria-hidden="true" className="text-text-muted">
            ›
          </li>
          <li>{portal.acronym}</li>
          <li aria-hidden="true" className="text-text-muted">
            ›
          </li>
          <li aria-current="page">{tabLabel}</li>
        </ol>
      </nav>

      <section
        aria-label="Portal em inspeção"
        className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-surface p-5 shadow-card"
      >
        <div className="flex flex-col gap-1">
          <p className="text-label font-medium tracking-wide text-text-muted uppercase">
            Portal em inspeção
          </p>
          <PageTitle documentTitle={`${tabLabel} — ${portal.acronym}`} className="text-section">
            {`${portal.name} (${portal.acronym})`}
          </PageTitle>
          <p className="text-label text-text-muted">
            {portal.domain}
            {collection.finishedAt
              ? ` · coleta de ${formatDate(collection.finishedAt)}`
              : ''} · {portal.pagesEvaluated}{' '}
            {portal.pagesEvaluated === 1 ? 'página avaliada' : 'páginas avaliadas'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {prev ? (
            <Link
              to={`/inspecao/${collectionId}/${prev.institutionId}/${tab}`}
              aria-label={`Portal anterior: ${prev.acronym}`}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-border-strong bg-surface px-3 text-label font-medium hover:bg-muted"
            >
              <ArrowLeft aria-hidden="true" size={16} strokeWidth={1.75} /> Anterior
            </Link>
          ) : null}
          <form onSubmit={go} className="flex items-center gap-2">
            <label htmlFor={selectId} className="sr-only">
              Trocar de portal
            </label>
            <select
              id={selectId}
              value={choice}
              onChange={(e) => setChoice(Number(e.target.value))}
              className="min-h-10 rounded-md border border-border-strong bg-surface px-2 text-label"
            >
              {sample.map((p, i) => (
                <option key={p.institutionId} value={p.institutionId}>
                  Portal {i + 1} de {sample.length} · {p.acronym}
                </option>
              ))}
            </select>
            <Button type="submit" variant="secondary" className="min-h-10 px-3">
              Ir
            </Button>
          </form>
          {next ? (
            <Link
              to={`/inspecao/${collectionId}/${next.institutionId}/${tab}`}
              aria-label={`Próximo portal: ${next.acronym}`}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-border-strong bg-surface px-3 text-label font-medium hover:bg-muted"
            >
              Próximo <ArrowRight aria-hidden="true" size={16} strokeWidth={1.75} />
            </Link>
          ) : null}
        </div>
      </section>

      <nav aria-label="Atividades do portal" className="border-b border-border">
        <ul className="flex flex-wrap gap-x-6">
          {TABS.map((t) => (
            <li key={t.path}>
              <NavLink
                to={`/inspecao/${collectionId}/${institutionId}/${t.path}`}
                aria-label={`${t.label}: ${counts[t.path]}`}
                className={({ isActive }) =>
                  cn(
                    'inline-flex min-h-11 items-center gap-2 border-b-2 text-label transition-colors duration-150',
                    isActive
                      ? 'border-accent font-medium text-text'
                      : 'border-transparent text-text-muted hover:text-text',
                  )
                }
              >
                {t.label}
                <Badge
                  variant={
                    t.path === 'validacao' && portal.findings.pending > 0 ? 'moderate' : 'neutral'
                  }
                >
                  {counts[t.path]}
                </Badge>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <Outlet context={{ collectionId, institutionId, portal }} />
    </div>
  );
}
