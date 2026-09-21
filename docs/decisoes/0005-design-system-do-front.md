# 0005 — Design system do front: divergências entre plano e Figma

- **Data:** 2026-09-21
- **Fase:** 5 — Base do front
- **Situação:** aceita

## Decisões

1. **A escala tipográfica segue o plano (seção 4), não o Figma.** No Figma, Título/Página está em 22/28 Medium, e a seção 4 do plano fixa 26/32 semibold. Pela regra do CLAUDE.md, o plano prevalece. Os tokens ficam em `--text-*` no `@theme` (`text-page`, `text-section`, `text-card`, `text-metric`, `text-body`, `text-label`, `text-badge`, `text-code`).
2. **Selo e código em 13 px.** O plano indica 12 px (selo) e 12,5 px (código), mas a regra obrigatória diz "nenhum texto de interface abaixo de 13 px". A regra prevalece.
3. **Fontes auto-hospedadas** (`@fontsource-variable/inter`, `@fontsource/roboto-mono`), sem Google Fonts. A demonstração para a banca funciona sem internet (seção 8.1) e não expõe visitantes a terceiros.
4. **Stepper como lista rotulada** (`<ol aria-label>`), não `<nav>`: as etapas não são links.
5. **Menu do celular**: gaveta com `role="dialog"` + `aria-modal`, foco preso, Esc fecha e devolve o foco ao botão. Enquanto ela está aberta, o conteúdo de fundo fica com `inert`. Fechada, usa o atributo `hidden` (não só CSS), para sair da árvore de acessibilidade.
6. **Alto contraste do Windows** (`forced-colors`): a barra de conformidade passa a usar `CanvasText`, porque as cores de fundo são descartadas nesse modo. Percentual e classificação sempre aparecem em texto.
7. **Rotas ainda sem tela** usam `PlaceholderPage`, e cada fase seguinte substitui as suas. O catálogo `/dev/ui` só existe com `import.meta.env.DEV` e fica fora do build de produção.
8. **Verificação de acessibilidade em duas camadas**: `vitest-axe` nos testes (jsdom, sem regras de layout como contraste) e axe-core no Chromium real sobre o catálogo e os layouts, com zero violações, inclusive nas regras de boas práticas.
