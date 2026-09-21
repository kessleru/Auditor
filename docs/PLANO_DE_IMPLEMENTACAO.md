# Plano de implementação — Auditoria de acessibilidade e usabilidade da Rede Federal

Plataforma web que audita portais dos Institutos Federais em duas camadas: **automatizada** (varredura de rotas + axe-core) e **manual** (inspeção heurística, tarefas-alvo e verificação assistiva), gerando relatórios orientados à correção.

- **Design (Figma):** https://www.figma.com/design/KqdzslCA6CFhZKBCqP4zhf/TCC-%E2%80%94-Auditoria-de-acessibilidade-e-usabilidade
- **Autor:** Otávio Kessler Ustra — TCC, Ciência da Computação, IFTM

---

## 0. Regras para o agente (ler antes de qualquer coisa)

### 0.1 Autoria de commits e PRs

**Nenhum commit, mensagem de commit, descrição de PR ou comentário pode conter atribuição ao Claude ou ao Claude Code.** Isso inclui, sem exceção:

- `Co-Authored-By: Claude <noreply@anthropic.com>` (ou qualquer variação com nome de modelo)
- `🤖 Generated with [Claude Code](...)`
- Links de sessão `claude.ai/code/session_...`
- Qualquer menção a IA, assistente ou ferramenta de geração na mensagem

O autor de todos os commits é o dono do repositório. Aplicar as três camadas abaixo, porque há relatos de a configuração isolada não ser respeitada em todos os casos:

**a) Configuração do projeto** — criar `.claude/settings.json` na raiz:

```json
{
  "attribution": {
    "commit": "",
    "pr": ""
  }
}
```

(`includeCoAuthoredBy` está depreciado; `attribution` é o substituto e tem precedência.)

**b) Instrução persistente** — criar `CLAUDE.md` na raiz com, como primeira linha:

```
NUNCA adicionar Co-Authored-By, "Generated with Claude Code", link de sessão ou qualquer atribuição a IA em commits, PRs ou comentários.
```

**c) Hook de segurança** — `commit-msg` que remove os trailers caso escapem. Versionar em `.githooks/commit-msg` e ativar com `git config core.hooksPath .githooks` (adicionar ao script `prepare` do `package.json` raiz):

```bash
#!/usr/bin/env bash
sed -i.bak -E '/^Co-Authored-By: Claude/Id; /Generated with \[?Claude Code/Id; /claude\.ai\/code\/session_/d' "$1"
rm -f "$1.bak"
```

O hook não alcança descrições de PR — ali vale a regra (b). Revisar toda descrição de PR antes de abrir.

### 0.2 Convenções

- **Commits:** Conventional Commits em português, no imperativo. Ex.: `feat(api): adiciona descoberta de rotas por sitemap`, `fix(web): corrige foco ao fechar o menu`.
- **Commits pequenos e atômicos**, um por unidade lógica. Nunca misturar refatoração com funcionalidade.
- **Branches:** `feat/<assunto>`, `fix/<assunto>`, `chore/<assunto>`.
- **PRs:** uma fase ou subfase por PR, com descrição contendo *o que muda*, *como testar* e *critérios de aceite atendidos*.
- **Idioma:** código (variáveis, funções, tipos) em inglês; textos da interface, comentários de domínio e documentação em português.
- **Nada de segredos no repositório.** `.env` no `.gitignore`, `.env.example` versionado.

### 0.3 Como trabalhar

- Executar **uma fase por vez**, na ordem. Não avançar sem cumprir os critérios de aceite da fase.
- Ao fim de cada fase: rodar lint, typecheck e testes; se algo falhar, corrigir antes de seguir.
- Em caso de ambiguidade, **perguntar** em vez de supor — especialmente em regras metodológicas (seção 3), que afetam a validade da pesquisa.

### 0.4 Skills do Claude Code

Conjunto enxuto, escolhido para esta stack. Não instalar outras sem necessidade: cada skill carregada consome contexto.

| Skill | Tipo | Uso neste projeto |
|---|---|---|
| Superpowers | plugin | fluxo planejar → especificar → testar. **O plano já existe:** executar este documento, não reescrevê-lo |
| Context7 | plugin | documentação atualizada de Tailwind v4, Express 5, React 19, Drizzle e Playwright — consultar antes de usar APIs dessas bibliotecas |
| Frontend Design | plugin oficial | qualidade visual das telas, respeitando os tokens da seção 4 |
| Playwright | plugin oficial | verificar no navegador o que foi construído e escrever os testes E2E |
| security-guidance | plugin oficial | revisão de segurança dos diffs (vem ativo por padrão; confirmar) |
| React Best Practices (Vercel) | arquivo | padrões de React; ignorar as regras específicas de Next.js |
| Grill Me | arquivo | usar **uma vez, antes da Fase 0**, apontando para este plano (depende da skill `grilling`, instalada junto) |
| a11y-code-review | arquivo | revisar todo PR que toque em `apps/web` contra a WCAG 2.2 AA |
| wcag-guide | arquivo | referência dos critérios ao classificar achados e escrever recomendações |
| design-system-a11y | arquivo | auditar os tokens (contraste, foco, alvos de toque) na Fase 5 |
| a11y-testing-coach | arquivo | apoio ao protocolo da inspeção manual (Fase 8) — ler o `SKILL.md` antes |

**1) Skills em arquivo** — na raiz do repositório:

```bash
bash scripts/install-skills.sh
```

**2) Plugins** — dentro do Claude Code, um comando por vez:

```
/plugin marketplace add obra/superpowers-marketplace
/plugin install superpowers@superpowers-marketplace
/plugin marketplace add upstash/context7
/plugin install context7@context7-marketplace
/plugin install frontend-design@claude-plugins-official
/plugin install playwright@claude-plugins-official
/plugin install security-guidance@claude-plugins-official
/reload-plugins
```

**3) Opcional:** copiar a skill pessoal `emil-design-eng` para `.claude/skills/emil-design-eng/`.

Cuidados:

- Skills da comunidade são código de terceiros. Ler cada `SKILL.md` antes do primeiro uso.
- **Não usar `npx skills add` para coleções inteiras**: ele instala todas as skills do repositório (dezenas) e em `.agents/skills/`, pasta de outros agentes. O `install-skills.sh` copia só as escolhidas, direto em `.claude/skills/`.
- Scripts `.sh` precisam de fim de linha LF: manter `.gitattributes` com `*.sh text eol=lf`.
- A Superpowers faz commits por conta própria — o hook da seção 0.1 é o que garante a regra de não atribuição nesses commits. Instalar o hook **antes** dos plugins.
- Se alguma skill contradisser este plano (estrutura, stack, regras metodológicas), **o plano prevalece**.

---

## 1. Visão geral da arquitetura

### 1.1 Estrutura do repositório

Monorepo com npm workspaces: **duas aplicações** e **um pacote compartilhado** de contratos.

```
auditoria-rf/
├── .claude/settings.json
├── .githooks/commit-msg
├── scripts/install-skills.sh # instala as skills baseadas em arquivo (seção 0.4)
├── CLAUDE.md
├── package.json              # workspaces + scripts raiz
├── tsconfig.base.json
├── apps/
│   ├── web/                  # React + Vite + TypeScript + Tailwind
│   └── api/                  # Express + TypeScript + SQLite, em camadas
├── packages/
│   └── contracts/            # schemas Zod e tipos compartilhados entre web e api
├── docker/                   # Dockerfile e docker-compose (demonstração e deploy)
└── docs/
    ├── PLANO_DE_IMPLEMENTACAO.md
    └── decisoes/             # ADRs curtos (uma decisão por arquivo)
```

### 1.2 Stack

| Camada | Escolha | Motivo |
|---|---|---|
| Front | React 19, Vite, TypeScript, Tailwind CSS v4 | pedido do projeto; Tailwind v4 aceita tokens via `@theme` no CSS |
| Roteamento | React Router | rotas públicas e protegidas |
| Dados no front | TanStack Query | cache, refetch e polling do progresso da coleta |
| Formulários | React Hook Form + Zod | validação tipada |
| Back | Node 22 LTS, Express 5, TypeScript | Express 5 trata erros de handlers assíncronos nativamente |
| Banco | SQLite via `better-sqlite3` + Drizzle ORM | schema tipado e migrations versionadas |
| Auditoria | Playwright (Chromium) + `@axe-core/playwright` | axe-core rodando sobre a página renderizada |
| Descoberta | `robots-parser`, `fast-xml-parser`, `cheerio` | robots.txt, sitemaps e extração de links sem abrir navegador |
| Validação | Zod, em `packages/contracts` | o mesmo schema valida a entrada na API e tipa as respostas no front |
| Tempo real | Server-Sent Events (SSE) | progresso da coleta sem polling; unidirecional e nativo do navegador (`EventSource`) |
| CLI | commander | executar coletas sem interface, com comando registrável na monografia |
| Empacotamento | Docker + docker compose | ambiente reproduzível com Chromium e disco persistente |
| Testes | Vitest, Supertest, Testing Library, Playwright | unidade, integração e ponta a ponta |
| Qualidade | ESLint (+ `eslint-plugin-jsx-a11y`), Prettier | acessibilidade verificada já no lint |

**Versões fixas:** `.npmrc` com `save-exact=true`. `axe-core`, `@axe-core/playwright` e `playwright` ficam com versão exata e **não são atualizados durante o período de coleta** — uma atualização muda o conjunto de regras e invalida a comparação entre coletas (ver 3.2.4).

### 1.3 Arquitetura em camadas da API

Dependências fluem **só para baixo**. Nenhuma camada importa de uma camada acima.

```
routes        → mapeia URL + método para o controller, aplica middlewares
controllers   → traduz HTTP ↔ domínio: valida entrada (Zod), chama o service, formata a resposta
services      → regras de negócio e orquestração; não conhece req/res
repositories  → único ponto de acesso ao banco; retorna entidades do domínio
db            → conexão, schema Drizzle, migrations, seeds
```

Módulos de infraestrutura, consumidos apenas por services:

```
infra/crawler     → descoberta de rotas (robots, sitemap, links)
infra/auditor     → Playwright + axe-core, snapshot da página
infra/queue       → fila de execução persistida no SQLite
infra/storage     → gravação dos snapshots em disco
infra/events      → barramento de eventos da coleta, publicado via SSE
infra/locks       → trava por domínio: impede duas coletas simultâneas no mesmo host
```

Estrutura de `apps/api/src`:

```
src/
├── app.ts                 # cria o app Express (sem listen) — facilita testes
├── server.ts              # listen
├── config/env.ts          # leitura e validação das variáveis de ambiente (Zod)
├── db/
│   ├── client.ts
│   ├── schema.ts
│   ├── migrations/
│   └── seeds/
├── modules/
│   ├── auth/          { auth.routes.ts, auth.controller.ts, auth.service.ts, auth.schemas.ts }
│   ├── institutions/  { *.routes.ts, *.controller.ts, *.service.ts, *.repository.ts, *.schemas.ts }
│   ├── routes-discovery/
│   ├── collections/   # coletas
│   ├── findings/      # violações e validação de achados
│   ├── inspections/   # tarefas-alvo e verificação assistiva
│   └── reports/       # agregações, comparativo, exportação CSV
├── infra/  { crawler/, auditor/, queue/, storage/, events/, locks/ }
├── cli/    { collect.ts, create-auditor.ts }   # usam os mesmos services da API
├── middlewares/  { requireAuditor.ts, errorHandler.ts, rateLimit.ts, notFound.ts }
└── shared/  { errors.ts, logger.ts, wcag.ts }
```

Organização **por módulo de domínio**, com as camadas dentro de cada módulo. Isso mantém a separação em camadas sem espalhar um mesmo assunto por pastas distantes.

### 1.4 Estrutura do front

```
apps/web/src/
├── main.tsx
├── app/        { router.tsx, providers.tsx, layouts/PublicLayout.tsx, layouts/AuditorLayout.tsx }
├── styles/     { tokens.css, globals.css }
├── components/ui/   # design system — ver seção 4
├── features/
│   ├── auth/
│   ├── audits/        # 1.1 nova auditoria, 1.2 revisão de rotas
│   ├── collections/   # 2.1 execução, 2.2 falha parcial
│   ├── inspection/    # 3.1 tarefa-alvo, 3.2 verificação assistiva, 3.3 validação
│   └── results/       # 0.2 visão pública, 4.1 painel, 4.2 comparativo, 4.3 detalhe
├── lib/  { api.ts, queryClient.ts, format.ts }
└── test/
```

---

## 2. Modelo de dados

```
users                (id, email UNIQUE, password_hash, name, created_at)

institutions         (id, name, acronym, domain UNIQUE, active, created_at)

page_functions       (id, key UNIQUE, label)
                     -- home, admission, student_aid_notices, library, student_support

routes               (id, institution_id FK, url, normalized_url, function_id FK NULL,
                      source: 'sitemap'|'crawler'|'manual',
                      status: 'suggested'|'confirmed'|'excluded'|'authenticated',
                      exclusion_reason NULL, replaced_by_route_id FK NULL,
                      discovered_at, confirmed_at NULL, last_seen_at NULL,
                      UNIQUE(institution_id, normalized_url))

collections          (id, status: 'queued'|'running'|'completed'|'partial'|'cancelled',
                      scope_json, axe_version, browser_version, user_agent,
                      created_by FK, created_at, started_at, finished_at)

collection_pages     (id, collection_id FK, route_id FK,
                      function_id FK NULL,          -- função da página no momento da coleta
                      status: 'queued'|'running'|'done'|'failed',
                      http_status NULL, error NULL, snapshot_path NULL,
                      passes_count, violations_count, incomplete_count, inapplicable_count,
                      evaluated_at NULL)

findings             (id, collection_page_id FK, rule_id, wcag_criteria,  -- ex.: "1.1.1"
                      principle: 'perceivable'|'operable'|'understandable'|'robust',
                      axe_impact: 'critical'|'serious'|'moderate'|'minor',
                      severity: 'critical'|'moderate', selector, html_snippet,
                      help, help_url, fingerprint,
                      validation: 'pending'|'confirmed'|'false_positive',
                      validation_note NULL, validated_by NULL, validated_at NULL)

target_tasks         (id, title, description, function_id FK, active)

task_inspections     (id, collection_id FK, institution_id FK, task_id FK,
                      result: 'completed'|'completed_with_difficulty'|'interrupted',
                      interactions, duration_seconds, depth, path_json,
                      heuristic NULL, severity NULL, note, inspector_id FK, created_at)

assistive_checks     (id, collection_page_id FK,
                      kind: 'keyboard'|'screen_reader'|'zoom_200'|'captions'|'contrast',
                      state: 'pass'|'barrier'|'not_applicable'|'pending',
                      severity NULL, note NULL, inspector_id FK, created_at)
```

Observações:

- **Sem dados pessoais de terceiros.** Só páginas públicas; `users` guarda apenas o auditor.
- Snapshots ficam **em disco** (`data/snapshots/<collectionId>/<pageId>.html.gz`), não como BLOB no SQLite.
- `fingerprint` = hash de `rule_id + selector normalizado + institution_id`, usado para agrupar violações de template (ver 3.3).
- `replaced_by_route_id` e `collection_pages.function_id` permitem comparar a **mesma função** entre coletas mesmo que a URL tenha mudado (ver 3.1.7).

---

## 3. Regras metodológicas (não negociáveis — afetam a validade da pesquisa)

### 3.1 Descoberta de rotas

1. Ler `robots.txt`; respeitar `Disallow` para o user-agent da ferramenta; extrair diretivas `Sitemap:`.
2. Sem sitemap declarado, tentar `/sitemap.xml`, `/sitemap_index.xml`, `/sitemap.xml.gz`. Suportar sitemap index (recursivo, com limite).
3. Sem sitemap, **crawler** a partir da página inicial:
   - somente mesma origem;
   - profundidade máxima **2**;
   - teto de **200 URLs** por instituição (configurável);
   - normalização: remover fragmento `#`, parâmetros de rastreio (`utm_*`, `fbclid`, `gclid`), barra final, host em minúsculas;
   - ignorar arquivos não navegáveis (`.pdf`, `.doc(x)`, `.xls(x)`, imagens, vídeos, `.zip`);
   - intervalo mínimo de **1,5 s** entre requisições ao mesmo host;
   - user-agent identificável: `AuditoriaRF/1.0 (+pesquisa academica IFTM; contato: <email>)`.
4. **Sugestão de função** por palavras-chave no título, na URL e no texto do link (ex.: "ingresso", "processo seletivo", "vestibular" → `admission`). A sugestão **nunca é aplicada sozinha**: a rota só entra na coleta após confirmação do auditor.
5. **Detecção de área autenticada:** marcar `status = 'authenticated'` quando a página redirecionar para URL contendo `login`/`auth`/`sso`/`cas`, ou contiver `input[type=password]`. Essas rotas ficam fora da coleta; só a página pública de login pode ser auditada.
6. Excluir domínios de desenvolvimento/homologação (`dev.`, `hml.`, `homolog.`, `staging.`), registrando o motivo.
7. **Mudança de rota entre coletas.** Se uma rota confirmada não responder mais (404/410) ou redirecionar permanentemente (301/308), a descoberta procura a nova URL da mesma função e a apresenta ao auditor como *possível substituição*. Confirmada, a rota antiga recebe `replaced_by_route_id` e o histórico da função continua contínuo. Nunca substituir sem confirmação.
8. **Limite ético de carga.** Nunca executar duas coletas simultâneas contra o mesmo domínio (`infra/locks`). Somado ao intervalo por host do item 3, garante no máximo uma requisição a cada 1,5 s por servidor avaliado, independentemente de quantas coletas estejam na fila.

### 3.2 Auditoria automatizada

1. Playwright Chromium, viewport 1280×800, `waitUntil: 'networkidle'` com timeout de 30 s; uma tentativa extra em caso de falha de rede.
2. `new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'])`.
3. Salvar **passes, violations, incomplete e inapplicable** — os quatro, não só violations.
4. Registrar por coleta a **versão do axe-core e do navegador** (reprodutibilidade). As versões ficam **congeladas** durante o período da pesquisa (ver 1.2); se uma atualização for inevitável, ela abre um novo ciclo de coletas, que não é comparado diretamente com o anterior.
5. Gravar o HTML renderizado comprimido como snapshot, com data e hora.
6. Mapeamento WCAG: tags `wcagXYZ` → critério `X.Y.Z`; o primeiro dígito define o princípio (1 perceptível, 2 operável, 3 compreensível, 4 robusto).
7. Mapeamento de severidade: `critical` e `serious` → **Crítico**; `moderate` e `minor` → **Moderado**. Documentar em ADR.
8. Portal que falhar é registrado como **ausência de dado**. **Nunca** tratar como conformidade zero nem incluir na média.

### 3.3 Métrica de conformidade

Definir e documentar em ADR **antes** de implementar os indicadores:

```
conformidade_da_página = passes / (passes + violations)          -- regras aplicáveis
conformidade_da_instituição = média das páginas confirmadas avaliadas com sucesso
```

- `incomplete` (casos que exigem revisão humana) **não entra** no cálculo, mas é exibido.
- Classificação na interface: **Bom ≥ 75%**, **Parcial 50–74%**, **Crítico < 50%** (limiares em constante única, fáceis de ajustar).
- Toda tela que mostrar esse número deve informar que ele cobre **apenas critérios verificáveis automaticamente**.
- **Violações de template:** o mesmo problema no cabeçalho aparece em todas as páginas. Por isso:
  - a métrica **principal** do comparativo entre instituições é o número de **problemas distintos** (agrupados por `fingerprint`);
  - o número de **ocorrências** é exibido como informação secundária;
  - um problema presente em **80% ou mais** das páginas avaliadas da instituição é marcado como *de template* e aparece destacado no relatório, porque corrigi-lo uma vez resolve todas as páginas — é a recomendação de maior retorno.
  - Sem esse agrupamento, um portal com mais páginas pareceria pior apenas por ter mais páginas. Registrar a regra em ADR.

### 3.4 Camada manual

- Tarefas-alvo cadastradas uma vez e reutilizadas em todas as instituições (mesmo enunciado = comparabilidade).
- Heurísticas priorizadas: H1 visibilidade do status, H2 correspondência com o mundo real, H3 controle e liberdade, H4 consistência e padronização, H6 reconhecimento em vez de memorização.
- Falso positivo **nunca é apagado**: exige justificativa e permanece registrado. A taxa de confirmação é resultado da pesquisa.

---

## 4. Design system (tokens extraídos do Figma)

Implementar em `apps/web/src/styles/tokens.css` com `@theme` do Tailwind v4:

```css
@import "tailwindcss";

@theme {
  --color-canvas: #F7F6F3;
  --color-surface: #FFFFFF;
  --color-muted: #F0EEEA;
  --color-border: #E6E3DE;          /* bordas decorativas: cards, notas, divisórias */
  --color-border-strong: #8C877F;   /* bordas de campos e controles: 3,57:1 sobre branco (WCAG 1.4.11) */
  --color-text: #21211F;
  --color-text-muted: #5C5C57;
  --color-accent: #1F4FA8;
  --color-accent-soft: #E8EFFB;
  --color-accent-text: #173C7E;
  --color-ok: #1B7A55;       --color-ok-soft: #E4F1EA;       --color-ok-text: #12563C;
  --color-warn: #8A5300;     --color-warn-soft: #FBF0DC;     --color-warn-text: #6B4000;
  --color-critical: #B3261E; --color-critical-soft: #FAE9E7; --color-critical-text: #8C1D17;

  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "Roboto Mono", ui-monospace, monospace;

  --radius-sm: 4px; --radius-md: 10px; --radius-lg: 16px;

  /* sombra discreta no lugar de mais bordas */
  --shadow-card: 0 1px 2px rgb(33 33 31 / 0.04), 0 6px 16px -4px rgb(33 33 31 / 0.05);
  --shadow-float: 0 2px 6px rgb(15 31 66 / 0.06), 0 12px 32px -8px rgb(15 31 66 / 0.10);
}
```

Escala tipográfica: Título/Página 26/32 semibold (−1,8%) · Título/Seção 18/26 semibold · Título/Card 15/22 semibold · Métrica 30/36 semibold · Corpo 14/21 · Rótulo 13/18 · Rótulo forte 13/18 medium · Selo 12/16 medium · Código 12,5/20 mono. **Nenhum texto de interface abaixo de 13 px.**

Componentes (`components/ui/`), espelhando o Figma:

| Componente | Variantes / regra obrigatória |
|---|---|
| `Button` | primary, secondary; anel de foco 2px `accent` sempre visível no `:focus-visible` |
| `Badge` (Selo) | critical, moderate, good, automated, inspection — **texto obrigatório**, cor nunca sozinha |
| `StatCard` (Indicador) | rótulo antes do valor, para o leitor de tela anunciar contexto primeiro |
| `ConformityBar` | sempre com percentual + classificação textual ao lado; `role="meter"` com `aria-valuenow` |
| `DataTable` | `<table>` real, `<th scope="col">`, `<caption>` (pode ser visualmente oculta) |
| `FindingCard` | origem, critério, página, trecho de código, recomendação |
| `SearchField` / `TextField` | rótulo visível acima; placeholder nunca substitui rótulo; erro ligado por `aria-describedby` |
| `EmptyState`, `ErrorState` | para 5.1 e 2.2 |
| `NavItem` | estados padrão e ativo; ativo = fundo `accent-soft` + texto `accent-text` + barra de 3px + `aria-current="page"` |
| `Stepper` (Indicador de etapa) | Escopo → Revisão de rotas → Coleta; etapa concluída diz "concluída" em texto; atual com `aria-current="step"` |

### 4.1 Marca

Arquivos: `apps/web/public/logo.svg` (símbolo com anel de foco, a partir de 32 px) e `apps/web/public/favicon.svg` (compacto, sem anel). Conceito: um "A" cuja barra horizontal é um sinal de verificação, envolto pelo anel do foco visível.

- Componente `Logo` com variantes `symbol`, `compact` e `horizontal` (símbolo + "Auditoria **RF**", com "RF" em `accent`).
- Na sidebar, usar a horizontal **sem** o subtítulo; na barra do visitante e no login, com o subtítulo "Acessibilidade e usabilidade".
- Quando a logo for link para a página inicial, o nome acessível é o do link ("Auditoria RF — início"), e o SVG recebe `aria-hidden="true"` para não ser anunciado duas vezes.

### 4.2 Ícones

`lucide-react`, traço 1,75, tamanho 18 px na navegação e 16 px em botões. **Todo ícone é decorativo** (`aria-hidden="true"`) e acompanha texto visível; botão só com ícone exige `aria-label`.

| Uso | Ícone lucide |
|---|---|
| Nova auditoria | `CirclePlus` |
| Em andamento | `Activity` |
| Histórico | `History` |
| Tarefas-alvo | `Target` |
| Verificação assistiva | `Accessibility` |
| Validação de achados | `ShieldCheck` |
| Painel | `LayoutDashboard` |
| Comparativo | `ChartColumn` |
| Instituições | `Landmark` |
| Sair | `LogOut` |
| Notas informativas | `Info` |
| Avisos de falha | `TriangleAlert` |
| Baixar / exportar | `Download` |
| Buscar | `Search` |
| Confirmar | `Check` |
| Tentar novamente | `RefreshCw` |

Os nomes de componentes do lucide-react mudam entre versões (ex.: `BarChart` virou `ChartColumn`); conferir na versão instalada com o Context7 antes de usar.

**Regra de bordas:** `border-strong` só em controles (campos, checkbox, radio, botões secundários pequenos). Cards, notas e divisórias usam `border`. Trocar uma pela outra quebra o contraste exigido ou pesa a interface.
| `Sidebar` (auditor) e `TopNav` (visitante) | ver seção 5.2 |

---

## 5. Telas e rotas do front

### 5.1 Mapa de telas (numeração do Figma)

| Figma | Rota | Acesso |
|---|---|---|
| 0.1 Entrar como auditor | `/entrar` | público — tela dividida: painel de marca com ilustração decorativa (`aria-hidden`) à esquerda; formulário de 400 px à direita. No mobile, o painel vira uma faixa curta com logo e título |
| 0.2 Visão pública | `/` | público |
| — Sobre a metodologia | `/metodologia` | público |
| 4.3 Detalhe da instituição (leitura) | `/instituicoes/:id` | público |
| 4.1 Painel | `/painel` | auditor |
| 4.2 Comparativo | `/comparativo` | auditor (versão pública em `/`) |
| 1.1 Nova auditoria | `/auditorias/nova` | auditor |
| 1.2 Revisão de rotas | `/auditorias/:id/rotas/:institutionId` | auditor |
| 2.1 Execução / 2.2 Falha parcial | `/coletas/:id` | auditor |
| 3.0 Portais em inspeção | `/inspecao/:collectionId` | auditor |
| 3.3 Validação dos achados (aba) | `/inspecao/:collectionId/:institutionId/validacao` | auditor |
| 3.1 Tarefas-alvo (aba) | `/inspecao/:collectionId/:institutionId/tarefas` | auditor |
| 3.2 Verificação assistiva (aba) | `/inspecao/:collectionId/:institutionId/verificacao?pagina=:pageId` | auditor |
| 5.1 Estado vazio | estado de `/painel` sem coletas | auditor |

### 5.2 Navegação

- **Visitante:** `TopNav` horizontal — marca, *Resultados · Instituições · Sobre a metodologia*, e *Entrar como auditor* como link à direita.
- **Auditor:** `Sidebar` fixa de 240 px, agrupada como as seções do Figma: *Auditorias* (Nova, Em andamento, Histórico) · *Inspeção manual* (uma entrada só: Portais em inspeção) · *Resultados* (Painel, Comparativo, Instituições). Item ativo: fundo `accent-soft`, texto `accent-text`, barra de 3 px à esquerda e `aria-current="page"`.
- **Indicador de etapa** no fluxo de auditoria: *Escopo → Revisão de rotas → Coleta*.
- **Mobile:** sidebar vira menu com botão `aria-expanded`, foco preso enquanto aberto, devolvido ao botão ao fechar, `Esc` fecha.

### 5.2.1 Inspeção manual: um portal por vez

A camada manual é organizada **por portal**, nunca como lista única da coleta inteira — misturar portais torna impossível saber de onde veio cada achado.

- **3.0** lista os portais da subamostra com o progresso de cada atividade e a situação (não iniciada, em andamento, concluída). Portais sem dados na coleta aparecem fora da lista, com o motivo.
- Ao abrir um portal, o componente **Contexto do portal** fica fixo no topo: nome, domínio, data da coleta, "Portal N de M", botões anterior/próximo e um `<select>` rotulado para trocar de portal. O `<h1>` da página inclui o nome do portal.
- As três atividades são **abas** (`AuditTabs`) desse portal — links com `aria-current="page"` e contagem em texto (ex.: "1 pendente", "2 de 4").
- Na validação, os achados são **agrupados por página**, com o grupo **"Em todas as páginas (template)"** primeiro, porque corrigi-lo resolve o portal inteiro. Cada grupo mostra título da página, caminho e número de achados.
- Na verificação assistiva, a página em verificação é escolhida num seletor rotulado, com o progresso "página N de M".

### 5.3 Página "Sobre a metodologia"

Página pública, sem tela correspondente no Figma — seguir o design system. Conteúdo obrigatório:

- o que a nota de conformidade mede e a fórmula usada (3.3), em linguagem simples;
- **o que ela não mede:** critérios não verificáveis automaticamente, áreas autenticadas, uso real por pessoas com deficiência;
- diferença entre problemas distintos e ocorrências, e o que é um problema de template;
- como os portais que falharam são tratados (ausência de dado, fora da média);
- versões do axe-core e do navegador usadas na última coleta, lidas da API;
- data da última coleta e contato do responsável pela pesquisa.

Toda tela que exibe a nota de conformidade traz um link para esta página.

### 5.4 Requisitos de acessibilidade do próprio sistema (WCAG 2.2 AA)

- Link "Pular para o conteúdo" como primeiro elemento focável.
- Marcos `<header>`, `<nav>`, `<main>`, `<footer>`; um único `<h1>` por página.
- Título do documento atualizado a cada rota (`<title>` descritivo).
- Foco movido para o `<h1>` após navegação entre rotas.
- Mensagens assíncronas (progresso da coleta, salvamento) em região `aria-live="polite"`.
- Alvos de toque de no mínimo 24×24 px (critério 2.5.8).
- Respeitar `prefers-reduced-motion`.

---

## 6. API — endpoints

Prefixo `/api/v1`. Respostas de erro no formato `{ error: { code, message, details? } }`.

**Públicos (visitante, só leitura)**

```
GET  /public/summary                         última coleta, contagens
GET  /public/institutions                    comparativo
GET  /public/institutions/:id                detalhe + histórico de coletas
GET  /public/institutions/:id/findings       achados confirmados
GET  /public/export.csv                      dados abertos + dicionário de dados
GET  /public/methodology                     versões, limiares e data da última coleta
```

**Autenticação**

```
POST /auth/login          (rate limit: 5 tentativas / 15 min por IP)
POST /auth/logout
GET  /auth/me
```

**Auditor (requer sessão)**

```
GET|POST|PATCH  /institutions
POST            /institutions/:id/discover          inicia descoberta de rotas
GET             /institutions/:id/routes
PATCH           /routes/:id                          confirmar, excluir, atribuir função

POST            /collections                         cria e enfileira coleta
GET             /collections/:id                     status + progresso por página
GET             /collections/:id/events              SSE: page-started, page-done, page-failed, collection-finished
POST            /collections/:id/cancel
POST            /collection-pages/:id/retry

GET             /collections/:id/inspection-summary  progresso da camada manual por portal (tela 3.0)
GET             /collections/:id/institutions/:institutionId/findings?groupBy=page
PATCH           /findings/:id/validation             confirmed | false_positive (+ nota obrigatória)

GET|POST        /target-tasks
POST            /task-inspections
PUT             /assistive-checks/:pageId/:kind
```

---

## 7. Fases de implementação

Cada fase termina com **lint + typecheck + testes passando** e um PR próprio.

### Fase 0 — Fundação do repositório
- Workspaces, `tsconfig.base.json`, ESLint, Prettier, `.editorconfig`, `.gitignore`, `.env.example`.
- `.claude/settings.json`, `CLAUDE.md`, `.githooks/commit-msg` e script `prepare` (seção 0.1).
- `scripts/install-skills.sh` versionado e skills instaladas (seção 0.4).
- Pacote `packages/contracts` (`@auditoria-rf/contracts`) com os schemas Zod de entrada e os tipos de resposta, consumido por `web` e `api` via workspace.
- `.npmrc` com `save-exact=true`; versões exatas de axe-core, `@axe-core/playwright` e Playwright.
- Scripts raiz: `dev` (sobe web e api juntos), `build`, `lint`, `typecheck`, `test`.
- **Aceite:** `npm install && npm run dev` sobe as duas apps; `web` e `api` importam um tipo de `@auditoria-rf/contracts` sem erro; commit de teste sai sem nenhuma atribuição.

### Fase 1 — Base da API
- `app.ts`/`server.ts`, `config/env.ts` com Zod, logger, `errorHandler`, `notFound`, Helmet, CORS restrito à origem do front.
- Drizzle + migrations + seed (funções de página, tarefas-alvo, **uma** instituição de exemplo: IFTM).
- `GET /api/v1/health`.
- **Aceite:** teste de integração do health com Supertest; migration roda do zero.

### Fase 2 — Autenticação do auditor
- Hash com `argon2`; sessão em cookie `httpOnly`, `secure` em produção, `sameSite=lax`.
- Criação do auditor **apenas por script CLI** (`npm run create-auditor`) — sem cadastro público.
- Middleware `requireAuditor`; rate limit no login.
- **Aceite:** testes de login válido, inválido, rota protegida sem sessão (401).

### Fase 3 — Instituições e descoberta de rotas
- CRUD de instituições.
- `infra/crawler` com as regras da seção 3.1; sugestão de função; detecção de área autenticada.
- **Aceite:** testes unitários de normalização de URL, parser de robots e sitemap (com fixtures locais, **sem rede nos testes**); teste do limite de profundidade e do teto de páginas.

### Fase 4 — Motor de auditoria e fila
- `infra/queue`: fila persistida em `collection_pages`; concorrência configurável (padrão 2); retomada após reinício do servidor.
- `infra/auditor`: Playwright + AxeBuilder conforme 3.2; snapshot em disco.
- Cálculo de conformidade (3.3), agrupamento por `fingerprint` e marcação de problemas de template no service de relatórios, com testes.
- `infra/locks`: trava por domínio (3.1.8).
- `infra/events` + `GET /collections/:id/events` (SSE), com heartbeat a cada 15 s para manter a conexão.
- CLI: `npm run collect -- --institution=<sigla|id> [--functions=home,admission]`. Usa os **mesmos services** da API, sem duplicar lógica; imprime o ID da coleta, as versões usadas e o resumo ao final.
- **Aceite:** auditoria de uma página HTML **servida localmente no teste**, com violações conhecidas, retorna os achados esperados; falha de rede vira `failed` sem derrubar a coleta; a CLI e a interface produzem o mesmo resultado para a mesma entrada; uma segunda coleta no mesmo domínio aguarda a primeira terminar.

### Fase 5 — Base do front
- Vite + Tailwind v4 + tokens (seção 4); fontes; React Router; TanStack Query; cliente de API.
- Componentes de `components/ui` com testes (incluindo `vitest-axe`).
- `PublicLayout` e `AuditorLayout` (seção 5.2), skip link, gerenciamento de foco e título.
- **Aceite:** página de catálogo de componentes (`/dev/ui`, só em desenvolvimento) sem violações no axe.

### Fase 6 — Acesso e visão pública
- Telas 0.1 e 0.2; `/instituicoes/:id` em modo leitura; página `/metodologia` (5.3).

### Fase 7 — Configuração e coleta
- Telas 1.1, 1.2, 2.1, 2.2 e estado vazio 5.1.
- Progresso da coleta via SSE (`EventSource`), atualizando o cache do TanStack Query a cada evento. Reconexão automática; se o SSE falhar três vezes seguidas, cair para polling de 5 s.
- Tela 1.2 mostra as **possíveis substituições de rota** (3.1.7) para confirmação.
- Mensagens de progresso anunciadas em região `aria-live="polite"`, com frequência limitada (no máximo uma a cada 10 s) para não sobrecarregar quem usa leitor de tela.

### Fase 8 — Camada manual
- Telas 3.1, 3.2, 3.3 e endpoints correspondentes.

### Fase 9 — Resultados e exportação
- Telas 4.1, 4.2, 4.3; exportação CSV com dicionário de dados.

### Fase 10 — Qualidade e entrega
- Testes E2E dos fluxos principais (Playwright).
- **Dogfooding:** rodar o próprio motor de auditoria contra o front em CI; o build falha se houver violação crítica.
- `docker/Dockerfile` baseado na imagem oficial do Playwright (já traz Chromium e dependências do sistema, na **mesma versão** fixada no `package.json`); `docker-compose.yml` com volume persistente para `data/` (banco SQLite e snapshots).
- README com instalação, execução, uso da CLI, decisões e limitações conhecidas.

---

## 8. Decisões incorporadas

Registro das melhorias levantadas no brainstorm e de onde cada uma entrou no plano. Cada decisão vira um ADR curto em `docs/decisoes/` durante a fase correspondente.

| # | Decisão | Onde está |
|---|---|---|
| 1 | Pacote `packages/contracts` com schemas e tipos compartilhados | 1.1, 1.2, Fase 0 |
| 2 | Progresso da coleta via SSE, com polling apenas como fallback | 1.2, 6, Fases 4 e 7 |
| 3 | CLI de coleta usando os mesmos services da API | 1.3, Fase 4 |
| 4 | Problemas distintos como métrica principal; marcação de problemas de template | 3.3, Fase 4 |
| 5 | Versões de axe-core e Playwright congeladas durante a pesquisa | 1.2, 3.2.4, Fase 0 |
| 6 | Página pública "Sobre a metodologia" | 5.3, 6, Fase 6 |
| 7 | Rastreamento de mudança de rota entre coletas | 2, 3.1.7, Fase 7 |
| 8 | Uma coleta por vez por domínio | 1.3, 3.1.8, Fase 4 |
| 9 | Modo escuro fora do escopo | 9 |
| 10 | Implantação em contêiner com disco persistente | 8.1, Fase 10 |

### 8.1 Implantação

- **Padrão para a banca:** demonstração local com `docker compose up`, a partir de um banco já populado com as coletas da pesquisa. Não depende de internet nem de terceiros no dia da apresentação.
- **Se for preciso publicar:** servidor (VPS) que rode Docker e ofereça **disco persistente** para o volume `data/`. A imagem é a mesma da demonstração local.
- **Não usar hospedagem serverless:** Playwright precisa de um navegador instalado e de execuções longas, e o SQLite precisa de um arquivo em disco que sobreviva entre requisições. Nenhum dos dois funciona nesse modelo.
- Backup: cópia periódica do arquivo SQLite e da pasta de snapshots; a CLI de coleta permite reconstruir qualquer coleta a partir das rotas confirmadas.

---

## 9. Fora do escopo

- Auditoria de áreas autenticadas (AVA, SUAP).
- Testes com participantes humanos.
- Cadastro público de usuários ou múltiplos perfis além de auditor e visitante.
- Aplicativos móveis nativos.
- Modo escuro: dobraria o trabalho de verificação de contraste sem ganho para a pesquisa.