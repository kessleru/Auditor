# 0009 — Resultados do auditor e exportação de dados abertos

- **Data:** 2026-09-22
- **Fase:** 9 — Resultados e exportação
- **Situação:** aceita

## Decisões

1. **Mesma coleta da visão pública.** Painel (4.1), comparativo (4.2) e detalhe (4.3) do auditor usam a coleta terminada mais recente de cada instituição, como a visão pública (ADR 0006). O mesmo service atende os dois casos, com uma opção que muda só a contagem de problemas.
2. **Problemas na visão do auditor** = tudo que não é falso positivo (confirmados + pendentes), deixado explícito na tela ("inclui achados ainda não validados"). A visão pública e o CSV contam só confirmados.
3. **Camada manual junto dos resultados.** A coluna "Inspeção" mostra a situação na subamostra (concluída, em andamento, pendente, fora da subamostra; "sem dado" e "não coletado" quando não há coleta avaliada). O detalhe reúne achados automatizados, tarefas concluídas com dificuldade ou interrompidas e barreiras da verificação assistiva, com filtros.
4. **Dados abertos em CSV** (`GET /public/export.csv?conjunto=instituicoes|problemas` e `GET /public/export-dictionary.csv`): RFC 4180, vírgula, decimal com ponto, UTF-8 com BOM (abre direto no Excel), datas ISO 8601 em UTC. A conformidade vai com quatro casas decimais; "sem dado" fica **vazio**, nunca 0. O dicionário é gerado da mesma lista de colunas, o que impede divergência (há teste).
5. **Rotas do auditor**: `GET /reports/overview` e `GET /reports/institutions/:id`; tela 4.3 em `/painel/instituicoes/:id` (a `/instituicoes/:id` continua pública).
6. As telas provisórias (`PlaceholderPage`) foram removidas: todas as rotas da seção 5.1 têm tela.
