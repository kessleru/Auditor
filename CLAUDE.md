NUNCA adicionar Co-Authored-By, "Generated with Claude Code", link de sessão ou qualquer atribuição a IA em commits, PRs ou comentários.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Estado do repositório

Projeto de TCC (Ciência da Computação, IFTM): plataforma que audita a acessibilidade e a usabilidade dos portais dos Institutos Federais em duas camadas — **automatizada** (descoberta de rotas + axe-core via Playwright) e **manual** (tarefas-alvo, verificação assistiva, validação de achados).

Fases 0–10 implementadas; ver `git log` e `docs/decisoes/`. A fonte da verdade é `docs/PLANO_DE_IMPLEMENTACAO.md`: executar o plano, não reescrevê-lo. Se uma skill ou sugestão contradisser o plano (estrutura, stack, regras metodológicas), o plano prevalece. Ler a seção relevante do plano antes de cada tarefa.

- Trabalhar **uma fase por vez**, na ordem da seção 7 do plano. Não avançar sem cumprir os critérios de aceite da fase; ao fim, rodar lint, typecheck e testes.
- Em ambiguidade, **perguntar** em vez de supor — principalmente nas regras metodológicas (seção 3), que afetam a validade da pesquisa.

## Comandos

```bash
npm install && npm run dev      # api (tsx watch, :3333) + web (Vite, :5173, proxy /api -> api)
npm run build                   # contracts primeiro, depois api e web
npm run lint                    # ESLint (inclui jsx-a11y strict no web) + prettier --check
npm run format                  # prettier --write
npm run typecheck               # tsc --noEmit em cada workspace
npm test                        # vitest run em cada workspace
npm test -w @auditoria-rf/api -- src/app.test.ts   # um arquivo de teste
npm run db:migrate              # aplica migrations (o servidor também aplica ao subir)
npm run db:seed                 # funções de página, tarefas-alvo e a Rede Federal (IFTM = id 1); idempotente
npm run db:generate -w @auditoria-rf/api   # gera migration após mudar src/db/schema.ts
```

`npm run create-auditor -- --email <e-mail> --name <nome>` é o único jeito de criar auditor; a senha é pedida sem eco (ou lida da entrada padrão), nunca como argumento. `npm run collect -- --institution=<sigla|id> [--functions=home,admission] [--auditor=<e-mail>]` executa uma coleta. `npm run discover -- --institution=<sigla|id>` (ou `--all`) roda a descoberta contra os portais reais e imprime as candidatas por função (nada é confirmado). Descoberta e coleta exigem um contato no user-agent: `CRAWLER_CONTACT_EMAIL` no `.env` ou, sem ele, o e-mail do primeiro auditor.

O motor precisa do Chromium do Playwright: `npx playwright install chromium` (e `sudo npx playwright install-deps chromium` se faltarem bibliotecas do sistema). Os testes de aceite da Fase 4 abrem o navegador de verdade contra HTML servido em `127.0.0.1`.

Node 22 LTS (`.nvmrc`, `engines.node: 22.x`) — o Chromium do Playwright e o `better-sqlite3` são compilados contra essa linha. ESLint fixado na 9.x enquanto `eslint-plugin-jsx-a11y` e `eslint-plugin-react` não suportarem o 10 (motivo no topo de `eslint.config.js`).

Testes: Vitest (unidade), Supertest (integração da API), Testing Library + `vitest-axe` (componentes), Playwright (E2E). Testes do crawler usam fixtures locais — **sem rede nos testes**; o motor de auditoria é testado contra HTML servido localmente.

## Arquitetura

Monorepo npm workspaces:

- `apps/web` — React 19, Vite, TypeScript, Tailwind v4 (tokens via `@theme` em `src/styles/tokens.css`), React Router, TanStack Query, React Hook Form + Zod. Organizado por `features/` (auth, audits, collections, inspection, results) + `components/ui/` (design system).
- `apps/api` — Node 22, Express 5, TypeScript, SQLite (`better-sqlite3`) + Drizzle. `app.ts` cria o app sem `listen` (para Supertest); `server.ts` aplica as migrations e faz o `listen`. Variáveis de ambiente validadas em `config/env.ts`; o `.env` fica na raiz e caminhos relativos resolvem a partir de `apps/api`.
- `packages/contracts` (`@auditoria-rf/contracts`) — schemas Zod e tipos compartilhados: o mesmo schema valida a entrada na API e tipa as respostas no front. O `exports` usa a condição `development` para apontar direto para `src/*.ts` (Vite, `tsx --conditions=development` e Vitest); fora dela resolve `dist/`, por isso o build de contracts vem antes. Imports relativos em código Node usam extensão `.js`.

API organizada **por módulo de domínio** (`src/modules/<módulo>/`), com camadas dentro de cada módulo. Dependências fluem só para baixo: `routes → controllers → services → repositories → db`. Services não conhecem `req/res`; repositories são o único acesso ao banco. `infra/` (crawler, auditor, queue, storage, events, locks) é consumida **apenas por services**. A CLI (`src/cli/`) usa os **mesmos services** da API — nunca duplicar lógica.

Descoberta de rotas: `infra/crawler/discover.ts` (puro, recebe um `HttpClient`); os testes usam o site falso em memória de `infra/crawler/__fixtures__/site.ts`. Detalhes e decisões em `docs/decisoes/0002-descoberta-de-rotas.md` e `0011-candidatas-de-rota-e-rede-federal.md`; palavras-chave (com exclusões) em `FUNCTION_KEYWORDS`, relevância das candidatas em `suggestionRelevance` (só ordena, nunca decide). Controllers validam a entrada com os schemas de `contracts` e passam dados já tipados aos services.

Robustez (ADR 0012): o cliente HTTP do crawler tenta de novo uma vez (rede, 429/503 com `Retry-After`), completa cadeia TLS incompleta pelo AIA (`tls-chain.ts`) e sai por `CRAWLER_PROXY` se definido; robots.txt 5xx = proibido (RFC 9309); a descoberta para após 10 falhas seguidas ou 20 min. Sem `CRAWLER_CONTACT_EMAIL`, o user-agent usa o e-mail do primeiro auditor. `TRUST_PROXY`/`COOKIE_SECURE=auto` para rodar atrás do nginx. Nunca contornar bloqueio de portal trocando o user-agent.

`src/services.ts` compõe todos os services; `createApp` e as CLIs usam essa mesma função (nunca montar services à mão). Métricas em `modules/reports/metrics.ts` (ADR 0003); motor, fila e travas na ADR 0004.

Fluxo da coleta: descoberta de rotas (robots → sitemap → crawler) → auditor confirma rotas e funções → coleta enfileirada em `collection_pages` (fila persistida, retomável, concorrência padrão 2) → Playwright + AxeBuilder por página → snapshot `.html.gz` em disco (`data/snapshots/<collectionId>/<pageId>.html.gz`, nunca BLOB) → progresso por SSE (`/collections/:id/events`, heartbeat 15 s; o front cai para polling de 5 s após 3 falhas).

API: prefixo `/api/v1`; erros sempre `{ error: { code, message, details? } }` (lançar `AppError`; `ZodError` vira 400). Módulos montados como fábricas (`createXRepository(db)` → `createXService(repo)` → `createXController(service)`), ligadas em `createApp({ db })`; testes usam `createTestDatabase()` (SQLite em memória migrado). Rotas de auditor passam por `requireAuditor`, que preenche `req.auditor`. Sessão: ver `docs/decisoes/0001-sessao-do-auditor.md`.

## Regras metodológicas que o código deve respeitar

Detalhes na seção 3 do plano. As que mais facilmente se quebram por engano:

- `axe-core`, `@axe-core/playwright` e `playwright` com **versão exata** (`.npmrc` `save-exact=true`) e **nunca atualizados** durante o período de coleta. Registrar versões do axe e do navegador em cada coleta.
- Crawler: mesma origem, profundidade 2, teto 200 URLs, intervalo mínimo 1,5 s por host, user-agent identificável; respeitar `robots.txt`. Nunca duas coletas simultâneas no mesmo domínio (`infra/locks`).
- Sugestões (função de página, substituição de rota) **nunca são aplicadas sem confirmação** do auditor.
- Salvar passes, violations, incomplete e inapplicable. Conformidade = `passes / (passes + violations)`; `incomplete` fica fora do cálculo.
- Portal que falhou = **ausência de dado**, nunca 0% nem incluído na média.
- Métrica principal do comparativo = problemas **distintos** (por `fingerprint`); problema em ≥ 80% das páginas = de template.
- 13 funções de página (ADR 0013). O comparativo conta só o **núcleo comum** (funções avaliadas em todas as instituições comparadas); a **cobertura** (encontradas ÷ esperadas) fica ao lado e nunca vira 0%. A coleta exige cada função do escopo confirmada ou marcada como não encontrada, com motivo.
- Falso positivo **nunca é apagado**: exige justificativa e permanece registrado.
- Severidade: `critical`/`serious` → Crítico; `moderate`/`minor` → Moderado.

## Acessibilidade do próprio front (WCAG 2.2 AA)

Regras do design system na seção 4 do plano; revisar todo PR que toque em `apps/web` com a skill `a11y-code-review`. Pontos obrigatórios: nenhum texto abaixo de 13 px; cor nunca é a única informação (selos sempre com texto); `border-strong` só em controles, `border` em cards/divisórias; ícones `lucide-react` sempre `aria-hidden` com texto visível; foco movido para o `<h1>` a cada troca de rota e `<title>` atualizado; skip link; `aria-live="polite"` para mensagens assíncronas (no máximo uma a cada 10 s no progresso da coleta); alvos ≥ 24×24 px; `prefers-reduced-motion`. Modo escuro está fora do escopo.

### Front: como construir telas

- Componentes em `components/ui` (exportados por `index.ts`); tokens tipográficos `text-page|section|card|metric|body|label|badge|code` e cores `text-text`, `text-text-muted`, `bg-surface` etc. Decisões na ADR 0005.
- Toda página começa com `<PageTitle>` (h1 com `tabIndex={-1}` que atualiza o `<title>`); o `Root` move o foco para ele a cada troca de rota.
- Dados via TanStack Query + `apiRequest` (`lib/api.ts`), validando a resposta com o schema de `contracts`; erros viram `ApiError` (`code`, `message`).
- Testes: `renderRoute(path)` e `stubApi()` em `src/test/render.tsx`; `expectNoAxeViolations(container)` em `src/test/axe.ts`. Estado oculto usa o atributo `hidden`, não só a classe CSS.
- Catálogo `/dev/ui` (só em desenvolvimento) deve continuar sem violações no axe.
- Visão pública: coleta terminada mais recente por instituição, só achados confirmados (ADR 0006). `/entrar` tem layout próprio; rotas do auditor passam por `RequireAuditor`.
- Fluxo de auditoria (ADR 0007): escopo na URL (`features/audits/scope.ts`), uma rota confirmada por função, progresso por `useCollectionEvents` (SSE → polling de 5 s após 3 falhas), anúncios com `useThrottledAnnouncement`. Testes de SSE usam `stubEventSource()` (`src/test/eventSource.ts`).
- Camada manual (ADR 0008): `modules/inspections` (subamostra, validação por fingerprint, tarefas, verificação assistiva); telas em `features/inspection` com `PortalLayout` (h1 = portal, abas por rota `:tab`). Falso positivo é definitivo.
- Resultados do auditor (ADR 0009): `results.service` sobre o mesmo `public-reports.service` com `problems: 'valid'`; CSV em `export.service` (colunas e dicionário na mesma constante). `API_URL` muda o alvo do proxy do Vite.
- Movimento (ADR 0010): usar só os tokens `animate-enter|fade|grow|drawer` (≤ 300 ms) sempre com `motion-safe:`; `animate-brand-*` só no login. `src/test/motion.test.ts` barra animação sem `motion-safe:`.
- Fieldset com cara de card: estilo no `div` de fora (a `legend` escapa do fundo do fieldset).
- Texto só para leitor de tela: prefira `aria-label` começando pelo texto visível a `<span class="sr-only">` colado ao texto (o espaço se perde).

## Convenções

- Commits: Conventional Commits **em português, no imperativo**, pequenos e atômicos (ex.: `feat(api): adiciona descoberta de rotas por sitemap`). Nunca misturar refatoração com funcionalidade.
- Branches `feat/<assunto>`, `fix/<assunto>`, `chore/<assunto>`; um PR por fase/subfase, com *o que muda*, *como testar* e *critérios de aceite atendidos*.
- Código (identificadores) em inglês; interface, comentários de domínio e documentação em português.
- Decisões relevantes viram ADR curto em `docs/decisoes/` (uma por arquivo).
- Consultar o Context7 antes de usar APIs de Tailwind v4, Express 5, React 19, Drizzle, Playwright e lucide-react (nomes de ícones mudam entre versões).
