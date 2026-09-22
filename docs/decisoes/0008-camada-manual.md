# 0008 — Camada manual: subamostra, validação e registro das inspeções

- **Data:** 2026-09-22
- **Fase:** 8 — Camada manual
- **Situação:** aceita (decisões metodológicas tomadas com o autor)

## Decisões

1. **Subamostra escolhida pelo auditor.** Em cada coleta terminada, o auditor escolhe quais portais avaliados entram na camada manual. A escolha fica na tabela `inspection_sample` (coleta, instituição, quem escolheu, quando), fora da lista original da seção 2. Portais sem dado na coleta nunca entram.
2. **Validação por problema distinto.** Confirmar ou marcar como falso positivo vale para todos os achados com o mesmo `fingerprint` na coleta, em todas as páginas. É coerente com a métrica principal (problemas distintos) e evita validar o mesmo elemento do cabeçalho em cada página. A taxa de confirmação é contada por problema distinto.
3. **Falso positivo é definitivo.** Ele exige uma justificativa de pelo menos 10 caracteres e não pode ser revertido (409 `FALSE_POSITIVE_FINAL`): "falso positivo nunca é apagado" (seção 3.4). Um problema confirmado ainda pode virar falso positivo.
4. **Critério de parada da tarefa-alvo:** 5 minutos ou 15 interações, o que vier primeiro (`TASK_LIMITS` em `packages/contracts`, exibido na tela e na metodologia). Uma tarefa concluída com dificuldade ou interrompida exige heurística (H1, H2, H3, H4 ou H6), severidade e observação.
5. **Uma inspeção por tarefa, portal e coleta** (índice único): salvar de novo substitui o registro anterior. As tarefas exibidas são as ativas das funções do escopo da coleta.
6. **Verificação assistiva:** cinco verificações por página avaliada (teclado, leitor de tela, ampliação a 200%, legendas, contraste). Barreira exige severidade e descrição. A página conta como concluída quando as cinco estão registradas.
7. **Situação do portal** (tela 3.0): *não iniciada* sem nenhum registro; *concluída* com todos os problemas validados, todas as tarefas registradas e todas as páginas verificadas; *em andamento* nos demais casos.
8. **Organização do código:** validação, tarefas e verificações ficam num único módulo da API (`modules/inspections`), porque compartilham as mesmas guardas (coleta terminada, portal na subamostra). A validação continua no endpoint do plano, `PATCH /findings/:id/validation`.
9. **Interface:** um portal por vez. O `<h1>` é o nome do portal, as abas são links com contagem e a troca de portal usa `<select>` + botão "Ir" (sem navegar só ao mudar a opção, WCAG 3.2.2). Heurística e severidade são grupos de rádio, no lugar dos chips do Figma.
