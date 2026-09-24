# 0013 — 13 funções de página, "não encontrada" e comparação pelo núcleo comum

- **Data:** 2026-09-24
- **Fases:** 3, 4, 6, 7 e 9 (revisão metodológica)
- **Situação:** aceita (decisões metodológicas tomadas com o autor)

## Contexto

O plano avaliava 5 funções por portal (página inicial, ingresso, editais de auxílio, biblioteca, assistência estudantil). O autor considerou que há mais páginas essenciais para os estudantes e pediu para ampliar a lista, adaptando a comparação para continuar justa. Com mais funções, nem todo portal tem todas as páginas. Se cada instituição fosse medida sobre o que tem, a comparação misturaria conjuntos diferentes, e quem tem mais páginas acumularia mais problemas distintos só por isso.

## Decisões

1. **13 funções.** Às 5 originais somam-se: cursos ofertados (`courses`), calendário acadêmico (`academic_calendar`), horários de aula (`class_schedule`), contato (`contact`), ouvidoria (`ombudsman`), acesso à informação (`information_access`), núcleo de acessibilidade/NAPNE (`accessibility_support`) e campi e unidades (`campuses`). Continua **uma rota confirmada por função** em cada instituição (ADR 0007). O NAPNE, antes palavra-chave da assistência estudantil, ganhou função própria.
2. **Sugestão.** Cada função nova tem palavras-chave em `FUNCTION_KEYWORDS`, com exclusões (a página "Acessibilidade" de atalhos de teclado não é o NAPNE; concurso e minicurso não são oferta de cursos). A sugestão continua só sugestão.
3. **Tarefas-alvo.** Uma por função nova, com o mesmo enunciado para todas as instituições; a de contato já existia (página inicial). Funções e tarefas são garantidas ao subir o servidor e as CLIs (`seedReferenceData`).
4. **Função não encontrada.** O auditor registra "procurei e não existe", com o motivo (onde procurou): tabela `function_absences`. Função com rota confirmada não pode ser marcada; confirmar uma rota desfaz a marcação.
5. **Coleta com escopo revisado.** A coleta só começa quando cada função do escopo, em cada instituição, está confirmada ou marcada como não encontrada (`422 FUNCTIONS_NOT_REVIEWED`). O escopo é gravado sempre com a lista explícita de funções (sem escolha, as 13). Assim "não tem a página" nunca se confunde com "não foi revisado". Rotas confirmadas sem função ficam fora da coleta.
6. **Cobertura** = funções do escopo que o portal tem ÷ funções do escopo (ex.: 12 de 13), com a lista das não encontradas. É exibida ao lado da nota e **nunca vira 0%** (coerente com a seção 3.2.8). Coletas antigas, sem escopo explícito, não têm cobertura medida.
7. **Núcleo comum.** O ranking compara só as funções **avaliadas com sucesso em todas** as instituições comparadas (as sem dado ficam fora, seção 3.2.8). Conformidade, problemas distintos, críticos e de template do comparativo contam só as páginas dessas funções; cada instituição é medida sobre o mesmo conjunto. Na visão pública, o núcleo é calculado sobre a coleta mais recente de cada instituição (ADR 0006); na CLI de coleta, sobre as instituições da coleta.
8. **Todas as páginas** (`overall`): conformidade e problemas de todas as páginas avaliadas da instituição ficam no relatório dela, como complemento. Não servem para ranking.
9. **Página que falhou** numa função tira essa função do núcleo comum (não há dado daquela instituição para compará-la); ela não conta como não encontrada.
10. **Histórico** da instituição continua com a conformidade de todas as páginas de cada coleta: o núcleo depende das outras instituições e mudaria retroativamente.
11. **CSV:** `conformidade`, `problemas_confirmados` e `paginas_avaliadas` passam a ser do núcleo comum; colunas novas `nucleo_comum`, `conformidade_todas_paginas`, `problemas_todas_paginas`, `funcoes_encontradas`, `funcoes_esperadas` e `funcoes_nao_encontradas`, com o dicionário atualizado.

## Consequências

- Coletas feitas com as 5 funções continuam válidas: o núcleo comum entre elas e as novas fica nas funções que todas tiverem.
- Quanto mais funções uma instituição deixar sem página, menor tende a ser o núcleo comum de toda a comparação. A cobertura mostra de onde vem isso.
- A camada manual cresce com o escopo: até 13 páginas por portal na verificação assistiva e 12 tarefas-alvo.
- Supera, na seção 2 do plano, a lista de 5 funções de `page_functions`, e, na seção 3.3, a média simples de todas as páginas como base do comparativo.
