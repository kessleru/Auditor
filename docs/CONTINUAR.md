# Onde parou (28/09/2026, 2ª sessão) — para o próximo Claude continuar

Branch: `claude/docs-continuous-reading-1qb2x8`, a partir da `main` com o PR #24 (prévia visual e
demonstração) já integrado. O autor pediu para seguir **sem parar** e, ao terminar, fazer **ciclos
de revisão e melhoria**, priorizando a **qualidade da auditoria**. Decisões de método (seção 3 do
plano) **não mudam sem o autor**: estão listadas em "Decisões do autor".

## Feito nesta sessão (números = itens da lista anterior)

| Item | O que mudou |
| --- | --- |
| 3 | Verificações que o axe não decidiu (`incomplete`) listadas na aba de validação, por regra, com o motivo em português (locale do axe). **Só leitura** |
| 4 | `npm run fingerprint:report -- --collection=<id>`: mede o agrupamento (regra + seletor) contra seletor sem `nth-child` e contra o HTML do elemento |
| 5 | Elemento vai para o centro da janela antes da foto (aviso de cookies e cabeçalho fixo deixam de cobrir) |
| 6 | `npm run evidence:backfill`: evidência de contraste e tamanho do alvo das coletas antigas, a partir do `.axe.json.gz` |
| 7 | Visão pública e CSV dizem por que o portal ficou sem dado: bloqueou a ferramenta × fora do ar × falha da ferramenta (`motivo_sem_dado`) |
| 8, 28 | Tempo de carregamento de cada página (Navigation Timing) e falhas por motivo: bloco "Confiabilidade da coleta" e fim do `npm run collect` |
| 9, 10 | nginx com CSP, `nosniff`, `Referrer-Policy`, `frame-ancestors`; `location ^~ /api/`. Validado com a imagem `nginx:1.29-alpine` e no navegador (sem violação de CSP) |
| 14, 15 | E2E e dogfood rodados (verdes); `/dev/ui` sem violação no navegador real; axe em 390 e 1280 px nas telas do auditor |
| 16 | Link "abrir a foto em tamanho real (abre em nova aba)" |
| 17, 29 | Evidência: fonte do contraste (a amostra usa a fonte do portal), tamanho do alvo e distância (`target-size`), endereço da imagem, destino do link, tipo do campo |
| 18, 20, 21 | Spec corrigida; README (prévia, demonstração, comandos, limitações; caminhos do launcher que tinham perdido a `\`); ADRs 0014–0016 no plano |
| 25 | `npm run retest -- --institution=<sigla> [--rounds=2] [--out x.json]`: teste-reteste, concordância entre rodadas, nada gravado |
| 26, 27 | Página `/indicadores` (auditor): taxa de confirmação por regra (CSV com dicionário) e acerto da sugestão de função |
| 31, 32 | Limitações no README e na `/metodologia` (identificação `AuditoriaRF`, só desktop, recursos da página, conteúdo após rolagem) |
| 34 | `npm run backup [-- --out <pasta>]`: cópia online do SQLite e dos snapshots |
| 35 | Conferido: sessões vencidas são apagadas a cada login (`deleteExpiredSessions`) |
| 36 | Limite por IP na API pública (600/10 min), nas fotos (3.000/10 min) e nos CSVs (20/10 min) |
| 37 | `.github/workflows/ci.yml`: lint, tipos, testes; build, E2E e dogfood (falha com achado crítico). **Ainda não rodou no GitHub** |
| 38 | Filtros por regra e severidade na validação (em lote, não: ver decisões) |
| 39 | Coluna "Autor" na lista de coletas |
| 40, 41 | `/metodologia` explica foto e evidência, bloqueio antirrobô e limites; E2E da prévia visual |
| — | ADR 0015 (demonstração) escrita; ADR 0014 ampliada |
| — | Achados da revisão: 7 regras do axe sem tradução no locale (ex.: `target-size`) ganharam título em português; tabela que rola em tela estreita vira região focável (WCAG 2.1.1); "sem dado" sem página que falhou não é mais "bloqueio"; lint ignora `playwright-report` e `e2e/.auth` |

| — | Revisão do PR (9 achados, todos corrigidos): acerto da sugestão usa o host real do portal (a origem pode ser `portal.<domínio>`); navegador que cai conta como falha da ferramenta; `${data}` do locale não aparece mais cru; inconclusivas não são relidas a cada validação; tabela reavalia a rolagem quando os dados alargam; CLI mostra "menos de 0,1 s" como a tela; tamanho do alvo nunca vira "."; classificação das falhas e regra de template em `contracts` (sem `infra/` fora dos services) |

| — | Revisão do programa inteiro (18 achados, todos corrigidos com teste). **Descoberta:** o robots.txt vale para a página inicial e para os redirecionamentos (salto para caminho proibido não é seguido); robots.txt inacessível por erro de rede = proibido (RFC 9309); `Location` malformado não derruba a descoberta; sitemap gzip limitado a 50 MB; "/x" → "/x/" não é rota movida; rota confirmada proibida pelo robots não é pedida; prioridade da fila em cache. **Rotas:** 301 para fora do domínio não vira candidata; rota manual em homologação recusada; substituição não tira a rota de outra função. **Coleta:** dois retestes da mesma instituição não rodam juntos; contorno de destaque sai do elemento mesmo com a foto falhando. **Métricas e validação:** sem função em comum, a avaliada fica sem número (não 0 problemas); falso positivo nunca é sobrescrito por outro achado do mesmo problema; achado novo de problema já validado herda a decisão (página refeita). **Front:** progresso cai para a consulta de 5 s quando o SSE é recusado (502); justificativa do falso positivo diz o mínimo; profundidade da tarefa ajustada ao que a API aceita |

Tudo com `npm run lint`, `npm run typecheck` e `npm test` passando (api 438, web 100, contracts 41).

## Falta: dados da demonstração (parte B do pedido anterior)

A rede do ambiente de nuvem desta sessão bloqueia os portais (`403` no proxy para
`www.cefetmg.br`, `www.ifnmg.edu.br` etc.): **rodar na máquina do autor** ou liberar os domínios nas
configurações de rede do ambiente. Passos (inalterados, ver também a ADR 0015):

1. Escolher 3 portais que respondem (IFTM e IFMG bloqueiam com Radware; **avisar o autor**, que tinha
   escolhido "IFTM + 2 de MG").
2. Banco à parte (`DATABASE_PATH`/`SNAPSHOTS_DIR` temporários), descobrir, confirmar uma rota por
   função (ou "não encontrada" com motivo), coletar, marcar a subamostra e validar cada problema.
3. Com os dados: `npm run fingerprint:report` e `npm run retest` para os números do TCC.
4. `npm run demo:export -- --collections=<ids>`, conferir o tamanho de `apps/api/demo/`, commitar.

## Decisões do autor (perguntar; não mudar sozinho)

1. **Espera `networkidle`** (3.2.1): portal com conexão permanente nunca fica ocioso → ausência de
   dado. Proposta (ADR 0012): `load` + até 30 s de `networkidle`, auditar mesmo sem ele e registrar.
2. **`robots.txt` na coleta**: a coleta não confere o robots na hora (rota manual, robots mudado).
3. **Verificações inconclusivas**: agora aparecem. Decidir se o auditor registra uma decisão sobre
   elas, se isso entra no cálculo, e se a coleta deve fotografar também esses elementos.
4. **Agrupamento dos problemas** (ADR 0003): na coleta local de teste, o seletor genérico `p` juntou
   dois textos diferentes de páginas diferentes num único problema "de template". O inverso
   (`nth-child` partindo um problema) também é possível. Rodar `npm run fingerprint:report` nos dados
   reais e decidir se a chave muda (ex.: regra + seletor + HTML normalizado).
5. **Só desktop (1280×800)**: segunda passada em 390 px? (item 22)
6. **Regras `best-practice`** (`region`, `heading-order`...): registrar à parte, fora da nota? (23)
7. **Conteúdo carregado ao rolar** não é avaliado. (24)
8. **LGPD nas fotos**: recorte pode mostrar pessoa; hoje a foto de achado confirmado é pública. (33)
9. **Validação em lote** (item 38): só com justificativa por problema? Hoje, um por vez.
10. **Captura da página inteira** (item 30): estimativa 0,5–1,5 MB por página em JPEG → 13 páginas ×
    42 instituições ≈ 270–820 MB por coleta. Vale o espaço?
11. **"Coleta mais recente" com "tentar de novo"** (ADR 0006): a ordem é pela data de término. Uma
    coleta antiga reaberta para refazer uma página termina de novo e passa à frente de uma coleta
    mais nova da mesma instituição na visão pública. Ordenar pelo início (ou pelo id)?

## Não verificado aqui

- **Imagens Docker (item 11)**: o `npm ci` dentro do contêiner falhou pela rede deste ambiente
  ("Exit handler never called"), não pelo Dockerfile. Rodar `cd docker && docker compose build` na
  máquina do autor; conferir que `apps/api/demo/` entra na imagem da API.
- **CI no GitHub**: primeira execução acontece no PR; conferir e corrigir se algo falhar.
- `npm audit`: 4 moderadas só em dev (esbuild antigo via `drizzle-kit`). A máquina do autor roda
  Node 24; o projeto fixa 22 (`nvm use` antes de coletar).

## Comandos novos

`npm run backup`, `npm run evidence:backfill`, `npm run fingerprint:report -- --collection=<id>`,
`npm run retest -- --institution=<sigla>`. Rotas novas: `GET /reports/indicators` (+ `rules.csv`,
`rules-dictionary.csv`) e `GET /collections/:id/institutions/:iid/incomplete`, ambas do auditor.

## Como trabalhar aqui (resumo para quem chega)

- Ler `CLAUDE.md` e a seção do plano antes de mexer. Regras da seção 3 do plano **não mudam sem o
  autor**: na dúvida, perguntar.
- TDD: teste falhando → correção → `npm run lint`, `npm run typecheck`, `npm test`.
- Commits pequenos, Conventional Commits em português, **sem** Co-Authored-By nem menção a IA (o
  hook `commit-msg` remove, mas não conte com ele).
- Todo PR que toca `apps/web` passa pela skill `a11y-code-review`; conferir também no navegador
  (axe em 1280 e 390 px).
- Na nuvem do Claude Code, o Chromium pré-instalado (`/opt/pw-browsers`) é de outra revisão que a do
  Playwright 1.63: crie uma pasta com `chromium-1243/chrome-linux64` → `chromium-1194/chrome-linux`
  e `chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell` →
  `headless_shell` (mais os arquivos `INSTALLATION_COMPLETE`) e aponte `PLAYWRIGHT_BROWSERS_PATH`
  para ela. Não rode `playwright install`.
- Próxima ADR livre: 0017.
