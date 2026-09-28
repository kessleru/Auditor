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

## Como trabalhar aqui (resumo para quem chega)

- Ler `CLAUDE.md` e a seção do plano antes de mexer. Regras da seção 3 do plano **não mudam sem o
  autor**: na dúvida, perguntar.
- TDD: teste falhando → correção → `npm run lint`, `npm run typecheck`, `npm test`.
- Commits pequenos, Conventional Commits em português, **sem** Co-Authored-By nem menção a IA.
- Todo PR que toca `apps/web` passa pela skill `a11y-code-review`.
- Decisão relevante vira ADR em `docs/decisoes/` (próximas: 0015 demonstração, 0017+).

## Lista completa: problemas, melhorias e revisões

Legenda: **[P]** problema real · **[M]** melhoria · **[D]** precisa de decisão do autor.
Ordem = prioridade sugerida.

### Qualidade da auditoria (prioridade do autor)

1. **[D] Espera `networkidle`** (seção 3.2.1): portal com chat, vídeo ou analytics contínuo nunca
   fica ocioso → tempo esgotado → ausência de dado. Proposta (ADR 0012): esperar `load` e até 30 s
   por `networkidle`, auditar mesmo sem ele e registrar isso na página.
2. **[D] `robots.txt` na coleta**: a coleta não confere o robots na hora de auditar (rota manual ou
   robots alterado depois da descoberta). Proposta: conferir e falhar a página com o motivo.
3. **[M/D] Itens `incomplete` visíveis**: hoje só o número aparece. Listar na aba de validação
   (regra, elemento, foto — fotografar também os nós `incomplete`). Decidir se a decisão do auditor
   sobre eles entra na conformidade ou só fica registrada.
4. **[M] Medir fragmentação de template**: seletores com `nth-child` diferentes entre páginas podem
   partir um problema de template em vários distintos (infla a métrica principal). Comparar, nos
   dados da demonstração, `rule+seletor` × `rule+html normalizado`. Se confirmar → **[D]** ajustar o
   `fingerprint` (ADR 0003).
5. **[M] Banner de cookies/LGPD e cabeçalho fixo** cobrem a foto do elemento. Medir; se for comum,
   rolar com margem para o cabeçalho fixo antes da foto.
6. **[M] Coletas antigas sem foto/evidência**: dá para preencher a evidência de contraste a partir do
   `.axe.json.gz` já salvo (foto não). Comando de preenchimento retroativo, opcional.
7. **[M] Portal bloqueado**: mostrar na visão pública o motivo da ausência de dado ("bloqueou a
   ferramenta" × "fora do ar"), hoje só aparece "sem dado".
8. **[M] Confiabilidade**: registrar na coleta quantas páginas falharam por tipo de motivo (tempo,
   HTTP, fora do domínio) para o capítulo de limitações do TCC.

### Segurança e implantação

9. **[P] nginx sem cabeçalhos de segurança** (CSP, `X-Content-Type-Options: nosniff`,
   `Referrer-Policy`, `frame-ancestors 'none'`). Atenção: `add_header` numa `location` apaga os
   herdados — repetir na `location` dos assets. CSP proposta acima.
10. **[P] nginx: a `location ~* \.(js|css|svg|woff2?)$` vence o prefixo `/api/`**: uma rota da API
    terminada nessas extensões seria servida como arquivo estático. Usar `location ^~ /api/`.
11. **[M] Imagem Docker**: conferir que o build ainda passa com o `.dockerignore` novo (Docker não
    estava rodando nesta máquina) e que `apps/api/demo/` entra na imagem.
12. **[M] `npm audit`**: 4 moderadas em dev (esbuild antigo via `@esbuild-kit`, dependência do
    drizzle-kit). Não afeta produção; atualizar quando o drizzle-kit permitir.
13. **[P] Node 24 na máquina**, projeto fixa Node 22 (`.nvmrc`). Testes passaram, mas o
    `better-sqlite3`/Chromium são compilados contra a 22: usar `nvm use` antes de coletar.

### Front e acessibilidade

14. **[M] Rodar o dogfood** (`npm run dogfood -- --base <url>`) e os E2E (`npm run test:e2e`) depois
    da prévia visual: nenhum dos dois foi rodado nesta sessão.
15. **[M] Catálogo `/dev/ui`**: ganhou o card de contraste; conferir no navegador (axe sem
    violação).
16. **[M] Foto em tamanho real**: a prévia limita a 320 px de altura; oferecer "abrir a foto" num
    link, com nome acessível.
17. **[M] Amostra de contraste**: usa `system-ui`; o portal pode usar outra fonte. Registrar a
    família da fonte na evidência (o axe não dá; pegar do `getComputedStyle` na coleta).

### Código e processo

18. **[M] Spec** diz `<n>.jpg`; o código grava `<achado>.jpg`. Ajustar a spec.
19. **[M] `docs/CONTINUAR.md`** é temporário: apagar quando a branch virar PR.
20. **[M] README**: citar a demonstração (`DEMO_DATA`, `npm run demo:export`) e a prévia visual.
21. **[M] Plano**: registrar ADRs 0014–0016 na tabela da seção 8.
