# 0010 — Movimento e fluidez

- **Data:** 2026-09-22
- **Fase:** 10 — Movimento e fluidez
- **Situação:** aceita

## Decisões

1. **Tokens num só lugar** (`styles/tokens.css`): curva `--ease-out-soft` e durações de 150, 220 e 300 ms. As animações de interface são `animate-enter` (entrada do conteúdo a cada rota, formulários que se abrem, confirmações e mensagens), `animate-fade` (fundo da gaveta), `animate-grow` (barras de conformidade que se preenchem) e `animate-drawer` (menu móvel). Nenhuma passa de 300 ms.
2. **Só `transform` e `opacity`.** A barra de progresso da coleta passou de `width` para `scaleX`, para não animar layout.
3. **Marca à parte.** As animações do painel do login (`animate-brand-*`, até 1,1 s) são decorativas, rodam uma vez, ficam em conteúdo `aria-hidden` e nunca entram em loop, de modo que o critério 2.2.2 (pausar) não se aplica.
4. **Sempre `motion-safe:`**, e o CSS global ainda zera durações sob `prefers-reduced-motion: reduce`. Um teste (`src/test/motion.test.ts`) varre o código e falha se alguma classe `animate-*` ou `transition-transform` estiver sem `motion-safe:`, se alguma animação de interface passar de 300 ms ou se alguma animação for infinita.
5. **Entrada por rota** com `key={pathname}` no conteúdo dos layouts: o conteúdo remonta a cada rota (inclusive nas abas da inspeção). O foco no `<h1>` continua acontecendo depois da troca, porque a animação não altera o momento em que o elemento existe.
6. **Transições de cor** (150 ms) em botões, abas, filtros e itens de navegação.

## Verificação

No Chromium real: com `reducedMotion: 'reduce'`, `document.getAnimations()` fica vazio no login, nas telas e ao abrir o menu. Sem a preferência, o login e a gaveta animam. O axe-core segue sem violações.
