# Onde parou (28/09/2026) — para o próximo Claude continuar

Branch: `feat/previa-e-demonstracao` (ainda sem PR). Desenho aprovado em
`docs/superpowers/specs/2026-09-27-previa-e-demonstracao-design.md`. O autor pediu para seguir
**sem parar** e, ao terminar, fazer **ciclos de revisão e melhoria em loop**, priorizando o que
melhora a **qualidade da auditoria**.

## Pedido do autor (3 partes)

- **A. Prévia visual dos problemas.** ✅ Feito e commitado: foto do elemento na coleta, evidência de
  contraste, `GET /findings/:id/screenshot`, `FindingPreview` no card. ADR 0014.
- **B. Demonstração pré-carregada.** Infra ✅ feita e commitada (`npm run demo:export`, importação no
  `db-seed`, conta "Demonstração" sem login, `DEMO_DATA`). **Falta gerar os dados** (ver abaixo) e
  escrever a ADR 0015.
- **C. Bateria de problemas e melhorias.** Em andamento (ver "Revisão").

## Commits desta branch

`docs` spec · `feat(api)` foto + evidência · `feat(api)` exemplo + rota da foto · `feat(web)` prévia ·
`feat(api)` demonstração · `fix(api)` timeout no corpo · `fix(api)` descoberta fora do domínio ·
`fix(api)` coleta fora do domínio (ADR 0016) · `feat` incomplete exibido · `chore(docker)`
.dockerignore. Tudo com lint, typecheck e testes passando até o último commit de código.

## B — como terminar a demonstração

Scripts de apoio (fora do repositório) em
`%TEMP%\claude\c--Users-otavi-OneDrive-Documentos-Auditor\ce44e1f4-...\scratchpad\demo\`
(`common.ts`, `discover.ts`, `candidates.ts`, `search.ts`, `decide.ts`, `collect.ts`, `pages.ts`).
Se sumirem, refazer: usam `createServices` com `DATABASE_PATH`/`SNAPSHOTS_DIR` apontando para um
banco à parte e `ensureDemoAuditor` de `apps/api/src/db/seeds/demo.ts`. Rodar de `apps/api` com
`npx tsx --conditions=development --env-file-if-exists=../../.env <script>`.

Estado da última descoberta (banco à parte, 28/09):

- **IFTM e IFMG: bloqueados** pelo Radware Bot Manager (302 para `validate.perfdrive.com`). Pela
  ADR 0012/0016 não se contorna: ficam como ausência de dado.
- **IFSULDEMINAS** terminou rápido demais: investigar (`candidates.ts IFSULDEMINAS`).
- **CEFET-MG** e **IFNMG** estavam no meio da descoberta quando parei (rodar de novo se preciso).

Passos restantes:

1. Escolher 3 portais que respondem (sugestão: CEFET-MG, IFNMG e IFSULDEMINAS ou IF Sudeste MG;
   o IFTM pode entrar com rotas manuais para mostrar "ausência de dado"). **Avisar o autor** da
   troca: ele tinha escolhido "IFTM + 2 de MG".
2. Confirmar uma rota por função (ou "não encontrada" com motivo) com `decide.ts`.
3. Coletar (`collect.ts`), marcar os 3 na subamostra (`services.inspections.setSample`) e validar
   cada problema distinto olhando foto e código (`services.inspections.validate`, conta demo,
   justificativa sempre).
4. `npm run demo:export -- --collections=<id>` com o `.env` apontando para o banco à parte; conferir
   o tamanho de `apps/api/demo/`; commitar; ADR 0015 (dados de demonstração).

## Revisão (C) — achados ainda não resolvidos

Qualidade da auditoria:

- `networkidle` nunca termina em portais com conexão permanente → ausência de dado. Pendente de
  decisão do autor (ADR 0012). **Perguntar**, não mudar sozinho.
- A coleta não confere o `robots.txt` na hora de auditar (rotas manuais ou robots alterado depois
  da descoberta). Decisão de método: **perguntar**.
- Itens `incomplete` do axe: agora contados na tela, mas o auditor não vê quais são. Proposta:
  listar na aba de validação (com foto). Decidir com o autor se a decisão dele entra no cálculo.
- Medir com os dados da demonstração se seletores com `nth-child` partem um problema de template
  em vários "distintos" (infla a métrica principal).

Outros:

- nginx sem cabeçalhos de segurança (CSP, `X-Content-Type-Options`, `frame-ancestors`); lembrar
  que `add_header` numa `location` apaga os herdados. CSP proposta:
  `default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self';
  connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; object-src 'none'`.
- `npm audit`: 0 em produção; 4 moderadas só em dev (esbuild antigo via `@esbuild-kit`).
- A máquina roda Node 24; o projeto fixa Node 22.

Depois: abrir PR da branch (o que muda, como testar, critérios de aceite; nunca atribuição a IA)
e seguir em ciclos de revisão → correção com teste → commit.
