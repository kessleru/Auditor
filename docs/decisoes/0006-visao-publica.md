# 0006 — Visão pública e validação dos achados nos indicadores

- **Data:** 2026-09-22
- **Fase:** 6 — Acesso e visão pública
- **Situação:** aceita (decisões metodológicas tomadas com o autor)

## Decisões

1. **Coleta exibida.** Cada instituição aparece com a sua coleta **terminada mais recente** (completa ou parcial; cancelada nunca conta). Se o portal falhou nela, aparece **Sem dado**: não se recorre a coletas antigas, para não misturar períodos no comparativo. Instituição que nunca passou por coleta aparece como "Ainda não avaliado".
2. **Problemas na visão pública = só confirmados.** Contagens e lista de achados públicos consideram apenas `validation = 'confirmed'`. Enquanto houver achados pendentes, a interface avisa "validação em andamento" e mostra quantos aguardam revisão. A visão do auditor (`summarizeInstitution` sem opção) continua contando tudo que não é falso positivo.
3. **Falso positivo ajusta a conformidade** (adendo à ADR 0003). Se todos os elementos reprovados de uma regra numa página forem marcados como falso positivo, a regra passa de violação a passe naquela página. Com qualquer elemento pendente ou confirmado, continua violação. O ajuste vale para a visão pública e para a do auditor.
4. **Textos das regras em português**, lidos do locale `pt_BR` do próprio axe-core fixado (`infra/auditor/rule-texts.ts`). A tradução é feita **na leitura**: os dados gravados não mudam. Regras sem tradução no locale (7 de 70) usam o texto original.
5. **Endpoints públicos** (sem sessão, somente leitura): `/public/summary`, `/public/institutions`, `/public/institutions/:id` (com histórico de conformidade por coleta), `/public/institutions/:id/findings` (problemas distintos confirmados, com um exemplo cada) e `/public/methodology`. O CSV de dados abertos fica para a Fase 9.
6. **Contato do responsável** na página de metodologia e no login vem de `CRAWLER_CONTACT_EMAIL`: é o mesmo contato que os portais veem no user-agent.

## Interface (divergências do Figma)

- Login sem "Esqueci minha senha": não há recuperação de senha; o auditor é criado pela CLI. O texto "fale com o responsável" leva ao e-mail de contato.
- Tabela pública com **um link por linha** ("Abrir", com nome acessível "Abrir relatório do IFTM") em vez de dois links para o mesmo destino.
- Gráfico de evolução (skill dataviz): uma série sem legenda, barras de até 24 px, rótulo só na coleta mais recente, tooltip no hover e **tabela equivalente** ("Ver dados em tabela") para teclado e leitor de tela.
- Card "Tarefas concluídas" do Figma (tela 4.3) entra com a camada manual, na Fase 8.
