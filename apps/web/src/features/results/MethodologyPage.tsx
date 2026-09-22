import { TASK_LIMITS } from '@auditoria-rf/contracts';
import type { ReactNode } from 'react';
import { Page, PageHeader } from '../../components/ui';
import { formatDate } from '../../lib/format';
import { useMethodology } from './api';

const sections = [
  { id: 'mede', title: 'O que a nota de conformidade mede' },
  { id: 'nao-mede', title: 'O que a nota não mede' },
  { id: 'problemas', title: 'Problemas distintos, ocorrências e template' },
  { id: 'manual', title: 'Camada manual' },
  { id: 'falhas', title: 'Portais que falharam' },
  { id: 'ferramentas', title: 'Ferramentas e última coleta' },
  { id: 'responsavel', title: 'Responsável pela pesquisa' },
] as const;

/**
 * Seção do texto: título com âncora e uma divisória fina acima, como nas páginas longas do GOV.UK.
 * Um cartão com sombra por seção transformaria um texto corrido em sete caixas.
 */
function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="flex flex-col gap-3 border-t border-border pt-6">
      <h2 className="text-section text-text">{title}</h2>
      <div className="flex flex-col gap-3 text-body text-text">{children}</div>
    </section>
  );
}

const pct = (value: number) => `${Math.round(value * 100)}%`;

/** Página "Sobre a metodologia" (seção 5.3). */
export function MethodologyPage() {
  const { data, isPending, isError } = useMethodology();
  const good = data ? pct(data.thresholds.good) : '75%';
  const partial = data ? pct(data.thresholds.partial) : '50%';

  return (
    <Page className="max-w-3xl gap-8">
      <PageHeader
        title="Sobre a metodologia"
        description="Como os portais dos Institutos Federais são avaliados e o que os números significam."
      />

      <nav aria-label="Nesta página" className="flex flex-col gap-2">
        <h2 className="text-label font-medium text-text">Nesta página</h2>
        <ul className="flex flex-col gap-1">
          {sections.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className="text-body text-accent-text underline underline-offset-2 hover:decoration-2"
              >
                {section.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <Section id="mede" title="O que a nota de conformidade mede">
        <p>
          Cada página é verificada pelo axe-core, uma ferramenta automática que testa regras da WCAG
          2.2 nível AA. Para cada página, contamos as regras que se aplicam a ela: as que passaram e
          as que foram violadas.
        </p>
        <p className="rounded-md bg-muted px-4 py-3 font-mono text-code">
          conformidade da página = regras que passaram ÷ (regras que passaram + regras violadas)
        </p>
        <p>
          Uma regra com qualquer elemento reprovado conta como violada. A nota da instituição é a
          média das suas páginas avaliadas. Casos que o axe marca como “revisão necessária” ficam
          fora da conta. Se o auditor confirmar que todos os elementos reprovados de uma regra eram
          falsos positivos, a regra volta a contar como aprovada.
        </p>
        <p>
          Classificação: <strong className="font-medium">Bom</strong> a partir de {good};{' '}
          <strong className="font-medium">Parcial</strong> de {partial} até abaixo de {good};{' '}
          <strong className="font-medium">Crítico</strong> abaixo de {partial}.
        </p>
      </Section>

      <Section id="nao-mede" title="O que a nota não mede">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Critérios que não podem ser verificados automaticamente — por exemplo, se um texto
            alternativo descreve bem a imagem ou se a ordem de leitura faz sentido. Por isso a nota
            não atesta conformidade integral com a WCAG.
          </li>
          <li>
            Áreas autenticadas dos portais (como sistemas acadêmicos): só páginas públicas são
            avaliadas.
          </li>
          <li>
            O uso real por pessoas com deficiência. A camada manual da pesquisa (tarefas e
            verificação com tecnologia assistiva) complementa, mas não substitui, testes com
            usuários.
          </li>
        </ul>
      </Section>

      <Section id="problemas" title="Problemas distintos, ocorrências e template">
        <p>
          <strong className="font-medium">Problemas distintos</strong> é a métrica principal do
          comparativo: o mesmo elemento com a mesma falha conta uma vez, mesmo que apareça em várias
          páginas. <strong className="font-medium">Ocorrências</strong> são todos os elementos
          reprovados, somados.
        </p>
        <p>
          Um problema presente em {data ? pct(data.templateThreshold) : '80%'} ou mais das páginas
          avaliadas (com pelo menos {data?.templateMinPages ?? 2} páginas) é marcado como{' '}
          <strong className="font-medium">de template</strong>: geralmente está no cabeçalho ou
          rodapé, e corrigi-lo uma vez resolve o portal inteiro. Sem esse agrupamento, um portal com
          mais páginas pareceria pior só por ter mais páginas.
        </p>
        <p>
          Na visão pública, contam apenas problemas{' '}
          <strong className="font-medium">confirmados</strong> por um auditor. Falsos positivos
          nunca são apagados: ficam registrados com a justificativa.
        </p>
      </Section>

      <Section id="manual" title="Camada manual">
        <p>
          Numa subamostra de portais escolhida pelo pesquisador, os achados automatizados são
          validados um a um (cada problema distinto é confirmado ou registrado como falso positivo,
          com justificativa), as tarefas-alvo são executadas com o mesmo enunciado em todos os
          portais e cada página passa por verificação com teclado, leitor de tela, ampliação a 200%,
          legendas e contraste.
        </p>
        <p>
          Uma tarefa-alvo é interrompida ao atingir {TASK_LIMITS.maxSeconds / 60} minutos ou{' '}
          {TASK_LIMITS.maxInteractions} interações, o que vier primeiro.
        </p>
      </Section>

      <Section id="falhas" title="Portais que falharam">
        <p>
          Quando nenhuma página de um portal pôde ser avaliada (fora do ar, tempo esgotado), o
          resultado é registrado como <strong className="font-medium">ausência de dado</strong>: o
          portal não recebe nota 0% e fica fora de todas as médias.
        </p>
      </Section>

      <Section id="ferramentas" title="Ferramentas e última coleta">
        {isPending ? (
          <p role="status" className="text-text-muted">
            Carregando versões…
          </p>
        ) : isError ? (
          <p className="text-text-muted">Não foi possível carregar as versões agora.</p>
        ) : (
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
            <dt className="text-text-muted">axe-core</dt>
            <dd>{data.axeVersion ?? 'nenhuma coleta ainda'}</dd>
            <dt className="text-text-muted">Navegador</dt>
            <dd>{data.browserVersion ?? 'nenhuma coleta ainda'}</dd>
            <dt className="text-text-muted">Última coleta</dt>
            <dd>
              {data.lastCollectionAt ? formatDate(data.lastCollectionAt) : 'nenhuma coleta ainda'}
            </dd>
            <dt className="text-text-muted">Regras</dt>
            <dd className="font-mono text-code">{data.axeTags.join(', ')}</dd>
          </dl>
        )}
        <p className="text-text-muted">
          As versões ficam congeladas durante a pesquisa: uma atualização mudaria o conjunto de
          regras e impediria comparar coletas.
        </p>
      </Section>

      <Section id="responsavel" title="Responsável pela pesquisa">
        <p>
          Otávio Kessler Ustra — Trabalho de Conclusão de Curso, Ciência da Computação, Instituto
          Federal do Triângulo Mineiro (IFTM).
          {data?.contactEmail ? (
            <>
              {' '}
              Contato:{' '}
              <a
                href={`mailto:${data.contactEmail}`}
                className="text-accent-text underline underline-offset-2 hover:decoration-2"
              >
                {data.contactEmail}
              </a>
              .
            </>
          ) : null}
        </p>
      </Section>
    </Page>
  );
}
