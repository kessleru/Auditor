import { pageFunctionLabels } from '@auditoria-rf/contracts';
import { useId } from 'react';
import { Badge } from '../../components/ui';
import { formatNumber } from '../../lib/format';
import { useInspectionIncomplete } from './api';

/**
 * Verificações que o axe não decidiu (`incomplete`) no portal: ficam fora da nota e pedem olhar
 * humano. Só leitura: a decisão do auditor sobre elas não é registrada (decisão do autor pendente).
 */
export function IncompleteChecks({
  collectionId,
  institutionId,
}: {
  collectionId: number;
  institutionId: number;
}) {
  const incomplete = useInspectionIncomplete(collectionId, institutionId);
  const headingId = useId();
  if (incomplete.isPending) return null;
  if (incomplete.isError) {
    return (
      <p className="text-label text-text-muted">
        Não foi possível carregar as verificações que o axe não decidiu.
      </p>
    );
  }
  const { rules, pagesWithoutResults } = incomplete.data;
  if (rules.length === 0 && pagesWithoutResults === 0) return null;
  const total = rules.reduce((sum, r) => sum + r.nodesTotal, 0);

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2 id={headingId} className="flex flex-wrap items-center gap-2 text-section text-text">
        Verificações que o axe não decidiu
        <Badge variant="neutral">
          {formatNumber(total)} {total === 1 ? 'elemento' : 'elementos'}
        </Badge>
      </h2>
      <p className="text-body text-text-muted">
        O axe não conseguiu decidir sozinho (por exemplo, texto sobre imagem de fundo). Ficam fora
        da nota e não viram problema: confira no portal. A decisão sobre elas não é registrada aqui.
      </p>
      {pagesWithoutResults > 0 ? (
        <p className="text-label text-text-muted">
          {pagesWithoutResults === 1
            ? '1 página avaliada está sem o resultado do axe em disco e ficou de fora.'
            : `${pagesWithoutResults} páginas avaliadas estão sem o resultado do axe em disco e ficaram de fora.`}
        </p>
      ) : null}
      <ul className="flex flex-col gap-3">
        {rules.map((rule) => (
          <li key={rule.ruleId}>
            <details className="rounded-lg bg-surface p-4 shadow-card">
              <summary className="min-h-6 cursor-pointer text-body font-medium text-text">
                {rule.title}{' '}
                <span className="font-normal text-text-muted">
                  · WCAG {rule.wcagCriteria} · {formatNumber(rule.nodesTotal)}{' '}
                  {rule.nodesTotal === 1 ? 'elemento' : 'elementos'} em {rule.pages}{' '}
                  {rule.pages === 1 ? 'página' : 'páginas'}
                </span>
              </summary>
              <ul className="mt-3 flex flex-col divide-y divide-border">
                {rule.nodes.map((node, index) => (
                  <li
                    key={`${node.pageUrl} ${node.selector} ${index}`}
                    className="flex flex-col gap-1 py-3"
                  >
                    <p className="text-body text-text">{node.reason}</p>
                    <p className="text-label text-text-muted">
                      {node.functionKey ? pageFunctionLabels[node.functionKey] : 'Página'} · seletor{' '}
                      <code className="font-mono text-code break-all">{node.selector}</code>
                    </p>
                    <pre className="overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-code whitespace-pre-wrap break-all">
                      {node.htmlSnippet}
                    </pre>
                  </li>
                ))}
              </ul>
              {rule.nodesTotal > rule.nodes.length ? (
                <p className="text-label text-text-muted">
                  Mostrando {rule.nodes.length} de {formatNumber(rule.nodesTotal)}.
                </p>
              ) : null}
              <a
                href={rule.helpUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-label text-accent-text underline underline-offset-2 hover:decoration-2"
              >
                como verificar (documentação do axe, em inglês; abre em nova aba)
              </a>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}
