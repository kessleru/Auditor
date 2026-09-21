# 0004 — Motor de auditoria, fila e trava por domínio

- **Data:** 2026-09-21
- **Fase:** 4 — Motor de auditoria e fila
- **Situação:** aceita

## Decisões

1. **Fila persistida em `collection_pages`.** O pool (`infra/queue`) só executa: pede a próxima página enquanto houver vaga (concorrência `COLLECTION_CONCURRENCY`, padrão 2). A página é reivindicada com `UPDATE … WHERE status = 'queued'` (atômico).
2. **Trava por domínio** (seção 3.1.8). Uma coleta só começa quando consegue, de uma vez, a trava de **todos** os domínios das suas instituições (`infra/locks`). Enquanto não consegue, fica `queued`: uma segunda coleta no mesmo domínio aguarda a primeira. Uma coleta marcada `running` no banco por **outro processo** (ex.: a CLI com o servidor no ar) também bloqueia.
3. **Uma página por host por vez.** Além da trava entre coletas, o executor nunca audita duas páginas do mesmo host ao mesmo tempo, e cada navegação respeita o intervalo mínimo de 1,5 s por host (o mesmo `HostThrottle` do crawler). A concorrência 2 se aplica, portanto, entre portais diferentes. Recursos da página (CSS, imagens) carregados pelo navegador não passam pelo intervalo; ele vale para as navegações.
4. **Navegação.** Chromium, viewport 1280×800, `waitUntil: 'networkidle'`, 30 s. Falha de rede **ou tempo esgotado** ganha uma tentativa extra; depois disso, a página fica `failed`. HTTP ≥ 400 é falha sem nova tentativa. Um erro inesperado (disco, navegador) também deixa a página `failed` sem derrubar a coleta.
5. **Resultados.** `collection_pages` guarda as contagens por regra (ADR 0003). `findings` guarda um achado por elemento violado. O HTML renderizado vai para `data/snapshots/<coleta>/<página>.html.gz` e, ao lado, `<página>.axe.json.gz` guarda o **resultado bruto completo** do axe (passes, violations, incomplete e inapplicable com os nós), para reprodutibilidade.
6. **Versões** (axe-core, navegador e user-agent) são gravadas quando a coleta começa e preservadas numa retomada.
7. **Situação final**: `completed` se tudo foi avaliado; `partial` se alguma página falhou. `POST /collection-pages/:id/retry` recoloca uma página que falhou na fila e reabre a coleta. `cancel` impede novas páginas e deixa as em execução terminarem.
8. **Retomada.** Ao subir, o servidor devolve à fila as páginas e coletas que estavam `running`. Ao desligar (SIGINT/SIGTERM), as páginas interrompidas continuam `running` e voltam para a fila na próxima inicialização, em vez de virarem falha.
9. **SSE** em `GET /collections/:id/events`, com eventos `page-started`, `page-done`, `page-failed` e `collection-finished` e heartbeat a cada 15 s. O estado inicial vem de `GET /collections/:id`.
10. **CLI = API.** `src/services.ts` compõe os services para a API e para a CLI (`npm run collect`). A CLI escolhe o auditor responsável (`--auditor`, ou o único cadastrado) e só encerra depois de terminar a coleta.
11. **User-agent.** Sem `CRAWLER_CONTACT_EMAIL`, criar coleta responde 503, como na descoberta.
