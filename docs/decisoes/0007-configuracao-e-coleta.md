# 0007 — Fluxo de configuração e acompanhamento da coleta

- **Data:** 2026-09-22
- **Fase:** 7 — Configuração e coleta
- **Situação:** aceita; a decisão 1 e a guarda das propostas em memória (decisão 3) foram substituídas pela [ADR 0017](./0017-descoberta-em-segundo-plano-e-auditoria-salva.md)

## Decisões

1. **~~Escopo na URL, sem rascunho no servidor.~~** Substituída pela ADR 0017: o escopo e a etapa ficam salvos no servidor. O modelo de dados não tem entidade "auditoria", e criar a coleta já a colocaria na fila. Por isso as telas 1.1 → 1.2 guardam o escopo em `?instituicoes=1,2&funcoes=home,admission`, que sobrevive a recarregar a página. A revisão fica em `/auditorias/nova/rotas/:institutionId` (o padrão `/auditorias/:id/rotas/:institutionId` do plano, com `:id = nova`), com visão geral em `/auditorias/nova/rotas`.
2. **Uma rota confirmada por função, em cada instituição.** O comparativo é por função. Confirmar outra rota para uma função já confirmada é recusado (409) salvo com `replaceConfirmed`, que faz a troca de forma atômica (a anterior volta a ser sugestão).
3. **Substituição de rota (seção 3.1.7).** Cada descoberta verifica as rotas confirmadas. Com 404/410, propõe outra rota sugerida para a mesma função; com redirecionamento permanente (301/308), propõe o destino (criado como sugestão, se ainda não existir). Com falha de rede, nada é concluído. A troca só acontece com `POST /routes/:id/replace`: a nova herda a função e fica confirmada; a antiga fica `excluded`, com `replaced_by_route_id` e o motivo. As propostas ficam no registro da descoberta (desde a ADR 0017, no banco): uma nova descoberta as recalcula.
4. **Rota manual** (`POST /institutions/:id/routes`): só URLs do domínio da instituição; entra `confirmed`, com origem `manual`.
5. **Coleta só com escopo completo.** Criar uma coleta com instituição sem rota confirmada para as funções escolhidas é recusado (`INSTITUTION_WITHOUT_ROUTES`). Sem isso, a instituição apareceria como "sem dado" sem nunca ter sido tentada.
6. **Progresso.** SSE (`EventSource`) atualiza o cache do TanStack Query a cada evento. O navegador reconecta sozinho, e cada reconexão recarrega a coleta para não perder eventos. Depois de 3 falhas seguidas, o SSE é fechado e a tela consulta a cada 5 s até a coleta terminar. Coleta terminada não abre SSE.
7. **Anúncios.** O progresso é anunciado em `aria-live="polite"`, no máximo uma vez a cada 10 s (`useThrottledAnnouncement`); a última mensagem sempre chega.
8. **Falha parcial (2.2)** fica na própria tela da coleta: motivo legível (tempo esgotado, certificado, HTTP 403…), URL e "Tentar novamente" por página. O texto reforça que falha é ausência de dado, não conformidade zero.
9. **Extras necessários ao fluxo**: `GET /collections?status=` (Em andamento e Histórico), cadastro de instituições em `/gestao/instituicoes`, Painel com o estado vazio 5.1 (os indicadores chegam na Fase 9). Cancelamento pede confirmação na própria tela.
