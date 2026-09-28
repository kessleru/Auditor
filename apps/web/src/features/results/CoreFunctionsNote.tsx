import {
  type PageFunctionKey,
  pageFunctionLabels,
  type PublicInstitution,
} from '@auditoria-rf/contracts';
import { useId } from 'react';
import { Link } from 'react-router';
import { formatPercent } from '../../components/ui';
import { formatNumber } from '../../lib/format';

/**
 * Explica a base da comparação (ADR 0013): conformidade e problemas do ranking contam só as
 * funções avaliadas em todas as instituições; a cobertura mostra quantas funções cada portal tem.
 */
export function CoreFunctionsNote({ coreFunctions }: { coreFunctions: PageFunctionKey[] }) {
  return (
    <p className="text-label text-text-muted">
      {coreFunctions.length === 0
        ? 'Ainda não há função avaliada em todas as instituições; a comparação aparece quando houver.'
        : `Comparação justa: conformidade e problemas contam só as ${
            coreFunctions.length === 1 ? 'página da função' : `${coreFunctions.length} funções`
          } avaliadas em todas as instituições (${coreFunctions
            .map((key) => pageFunctionLabels[key])
            .join(', ')}). A cobertura mostra quantas das páginas procuradas cada portal tem.`}{' '}
      <Link
        to="/metodologia#comparacao"
        className="text-accent-text underline underline-offset-2 hover:decoration-2"
      >
        Como a comparação é feita
      </Link>
    </p>
  );
}

/**
 * Sem página no núcleo comum (as instituições avaliadas não têm função em comum), o resumo fica
 * sem número: nunca 0 problemas.
 */
export const outsideCore = (institution: PublicInstitution) =>
  institution.status === 'evaluated' && institution.pagesEvaluated === 0;

/** Texto do resumo sem conformidade: fora do núcleo comum ou sem regra aplicável. */
export const noConformityText = (institution: PublicInstitution) =>
  outsideCore(institution) ? 'Sem função em comum para comparar' : 'Sem regra aplicável';

/** "11 de 13", ou travessão sem cobertura medida. */
export function coverageText(coverage: { found: number; expected: number } | null): string {
  return coverage ? `${coverage.found} de ${coverage.expected}` : '—';
}

/**
 * No relatório da instituição: de onde vêm os números do resumo (núcleo comum), como fica em todas
 * as páginas avaliadas e quais páginas procuradas o portal não tem.
 */
export function ComparisonBasis({ institution }: { institution: PublicInstitution }) {
  const headingId = useId();
  const { overall, coverage } = institution;
  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-3 rounded-lg bg-surface p-5 shadow-card"
    >
      <h2 id={headingId} className="text-card text-text">
        Base da comparação
      </h2>
      <dl className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <dt className="text-label text-text-muted">Números do resumo</dt>
          <dd className="text-body text-text">
            {outsideCore(institution)
              ? 'Nenhuma: as instituições avaliadas não têm função em comum'
              : institution.pagesEvaluated === 1
                ? '1 página, das funções que todas as instituições têm'
                : `${formatNumber(institution.pagesEvaluated)} páginas, das funções que todas as instituições têm`}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-label text-text-muted">Em todas as páginas avaliadas</dt>
          <dd className="text-body text-text">
            {overall
              ? `${overall.conformity === null ? 'sem regra aplicável' : formatPercent(overall.conformity)} de conformidade, ${formatNumber(overall.problems)} ${overall.problems === 1 ? 'problema' : 'problemas'} em ${formatNumber(overall.pagesEvaluated)} ${overall.pagesEvaluated === 1 ? 'página' : 'páginas'}`
              : '—'}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-label text-text-muted">Páginas encontradas</dt>
          <dd className="text-body text-text">
            {coverage ? `${coverageText(coverage)} funções procuradas` : 'Não medida nesta coleta'}
          </dd>
          {coverage && coverage.missing.length > 0 ? (
            <dd className="text-label text-text-muted">
              Não encontradas: {coverage.missing.map((key) => pageFunctionLabels[key]).join(', ')}
            </dd>
          ) : null}
        </div>
      </dl>
    </section>
  );
}
