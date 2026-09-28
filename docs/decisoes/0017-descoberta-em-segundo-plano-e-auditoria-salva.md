# 0017 — Descoberta em segundo plano e auditoria em montagem salva

- **Data:** 2026-09-28
- **Fases:** 3 (descoberta) e 7 (configuração e coleta)
- **Situação:** aceita; substitui a decisão 1 e a última frase da decisão 3 da ADR 0007

## Contexto

A descoberta de rotas já rodava no servidor, mas o estado dela (andamento, resumo, possíveis
substituições) ficava só em memória. A API reinicia a cada abertura do launcher: a descoberta em
andamento se perdia e o resumo sumia. Além disso, era preciso abrir cada instituição e clicar em
"Descobrir rotas", uma por uma.

O escopo da nova auditoria vivia só na URL (ADR 0007). Quem saía do fluxo para ver o Painel ou
fechava o navegador perdia as instituições e as funções escolhidas e recomeçava do zero. O autor
pediu que a descoberta e tudo ligado a ela rodem em segundo plano, e que a auditoria fique salva
na etapa em que parou, desde o clique em "Nova auditoria".

## Decisões

1. **Fila persistida da descoberta.** Cada rodada é uma linha de `discovery_runs` (`queued`,
   `running`, `completed`, `failed`), com o andamento, o resumo e as possíveis substituições. Um
   pool de trabalhadores, como o da coleta, pega a mais antiga da fila. Roda no máximo
   `DISCOVERY_CONCURRENCY` (padrão 3) ao mesmo tempo, sempre instituições diferentes. O intervalo de
   1,5 s por host (3.1.3) é o mesmo da coleta, compartilhado no processo.
2. **Retomada.** Ao subir, a API devolve para a fila o que estava em execução e recomeça a fila. A
   rodada interrompida começa de novo do zero. As rotas só são gravadas no fim, então nada fica pela
   metade.
3. **Auditoria em montagem no servidor.** Cada auditor tem no máximo um rascunho (`audit_drafts`)
   com o escopo, a etapa (`scope` ou `routes`) e a instituição em revisão. O formulário do escopo
   salva sozinho a cada pausa nas escolhas. Cada tela do fluxo grava a posição, e "Nova auditoria"
   volta para ela. O rascunho sai quando a coleta é criada (`POST /audit-draft/start`) ou quando o
   auditor descarta. Descartar não apaga decisões: rotas confirmadas e funções não encontradas são
   da instituição, não do rascunho.
4. **Descoberta automática só do que nunca foi olhado.** Confirmar o escopo põe na fila as
   instituições sem rota, sem função marcada como não encontrada e sem nenhuma descoberta. As que
   falharam ou já têm rotas só são descobertas de novo a pedido do auditor, por instituição ou em
   lote na visão geral. Assim um portal que bloqueia a ferramenta não é pedido de novo a cada vez
   que o escopo é salvo.
5. **CLI.** `npm run discover` roda a descoberta na hora (fora da fila), com o mesmo registro da
   rodada. Assim não pega rodadas que a API pôs na fila.
6. **Revisão fora da auditoria.** Aberta pela gestão de instituições, a revisão de uma instituição
   usa todas as funções e não mexe no rascunho.

## Consequências

- O Painel mostra a auditoria em montagem e o andamento da fila; a visão geral da revisão mostra a
  situação da descoberta de cada instituição (na fila, lendo o portal, concluída, falhou com o
  motivo).
- A URL deixa de carregar o escopo: links antigos com `?instituicoes=` caem na auditoria salva.
- A regra de carga (3.1.8) continua valendo dentro de um processo. Uma descoberta pela CLI ao mesmo
  tempo que a API não compartilha o intervalo por host, como já acontecia com a coleta.
