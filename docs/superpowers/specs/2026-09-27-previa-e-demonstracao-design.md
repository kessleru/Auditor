# Prévia visual dos problemas e demonstração pré-carregada

Data: 27/09/2026. Aprovado pelo autor do TCC na conversa de desenho.

## Objetivo

1. **Prévia visual (A):** o auditor (e o público, nos achados confirmados) vê como o elemento com
   problema aparece no portal, sem abrir o site: foto do elemento e, no contraste, uma amostra com
   as cores e o tamanho reais medidos pelo axe.
2. **Demonstração (B):** coletas reais, feitas em 27/09/2026 com as ferramentas do próprio sistema,
   empacotadas no repositório e importadas a cada subida do programa, para a apresentação.
3. **Revisão (C):** bateria de problemas e melhorias sobre o código já com A e B.

## A. Prévia visual

### Coleta

- Em `infra/auditor/page-auditor.ts`, **depois** do axe e do `page.content()` (o snapshot e o
  resultado não mudam), fotografar cada elemento reprovado:
  - uma foto por par (regra, seletor) na página; no máximo 30 por página;
  - recorte com margem de 16 px ao redor do elemento, contorno de destaque aplicado por estilo
    injetado só depois do snapshot; altura do recorte limitada a 600 px;
  - JPEG qualidade 75;
  - seletor dentro de iframe ou shadow DOM (alvo do axe com mais de um nível), elemento invisível ou
    sem tamanho: sem foto; falha de foto nunca falha a página.
- Arquivos em `SNAPSHOTS_DIR/<coleta>/<página>/<n>.jpg` (`snapshot-storage`).
- Nenhuma mudança de versão do axe nem do navegador; nenhuma mudança nas regras de 3.2.

### Dados

- Migration: `findings.evidence_json` (texto, nulo) e `findings.screenshot_path` (texto, nulo).
- `evidence_json` só para `color-contrast`, a partir de `node.any[].data` do axe:
  `{ kind: 'contrast', fgColor, bgColor, contrastRatio, expectedContrastRatio, fontSize, fontWeight }`.
- Coletas antigas continuam sem foto e sem evidência (não há como fotografar de novo).

### API

- `contracts`: o exemplo do problema ganha `findingId`, `screenshotUrl` (nulo) e `evidence` (nulo).
- `GET /api/v1/findings/:id/screenshot`: imagem do achado. Sem sessão, só para achado confirmado
  (a visão pública só mostra confirmados); com sessão de auditor, qualquer achado. 404 sem foto.

### Front

- `components/ui/FindingPreview.tsx`: foto (com `alt` que diz o que é a imagem) e, no contraste,
  amostra em SVG com as cores e o tamanho reais e o texto
  "Razão 2,8:1 — mínimo 4,5:1 (texto #777777 sobre #ffffff)". SVG porque o contraste baixo da
  amostra é proposital e o axe do próprio sistema não avalia texto de SVG.
- `FindingCard` recebe `preview`; usado na validação (inspeção), nos resultados do auditor e na
  visão pública. O `<pre>` com o código continua.
- Nunca injetar HTML do portal na página.

## B. Demonstração

- Construída num banco à parte (`DATABASE_PATH` e `SNAPSHOTS_DIR` temporários), com services e CLI
  do sistema: descoberta, confirmação de rotas (ou função não encontrada, com motivo), coleta e
  validação por problema distinto (confirmado ou falso positivo, sempre com justificativa).
- Portais: IFTM, CEFET-MG e IFMG. Tarefas-alvo e verificação assistiva ficam vazias (exigem
  teste humano com teclado e leitor de tela).
- Autor: conta "Demonstração" (`demonstracao@auditoria-rf.invalid`), com senha inutilizável: não
  entra no sistema, só assina as coletas e as validações.
- `npm run demo:export` grava `apps/api/demo/`: `dados.json.gz` (instituições por sigla, rotas,
  ausências, coletas, páginas, achados) e os arquivos (snapshot, axe e só as fotos dos exemplos
  exibidos nas telas).
- `db-seed` (que o launcher roda a cada subida) importa a demonstração se ela ainda não estiver no
  banco: idempotente, remapeia IDs, instituições casadas pela sigla, datas originais.
- Coletas normais: entram no histórico, no comparativo e no CSV como qualquer coleta. Coletas
  futuras do auditor passam à frente na visão pública (vale a mais recente).

## Testes

- Unidade: evidência de contraste a partir de um resultado do axe; importação idempotente.
- Aceite com navegador real (HTML servido em 127.0.0.1): coleta gera foto para o elemento reprovado
  e evidência de contraste.
- Integração: endpoint da foto (público só confirmado; auditor qualquer; 404 sem foto).
- Componentes: `FindingPreview` com e sem foto/evidência, sem violações no axe.

## Documentação

- ADR 0014 (evidência visual dos achados) e ADR 0015 (dados de demonstração).
