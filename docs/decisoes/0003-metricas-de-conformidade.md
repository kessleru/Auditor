# 0003 — Métricas: conformidade, severidade, problemas distintos e template

- **Data:** 2026-09-21
- **Fase:** 4 — Motor de auditoria e fila
- **Situação:** aceita (decisões metodológicas tomadas com o autor)

## Contexto

A seção 3.3 do plano exige documentar a métrica em ADR **antes** de implementar os indicadores. O plano fixa a fórmula e os limiares; os pontos abaixo definem como os resultados do axe-core entram nela.

## Decisões

1. **Conformidade da página** = `passes / (passes + violations)`, contados **por regra, de forma exclusiva**. Uma regra com algum elemento reprovado conta como violação e não como passe, mesmo que outros elementos passem. É o critério mais comum em estudos com axe e não é inflado por páginas com muitos elementos repetidos.
2. **`incomplete`** (casos que exigem revisão humana) fica **fora** do cálculo, mas é contado e exibido.
3. **Página sem regra aplicável** (`passes + violations = 0`) conta como avaliada, mas fica **fora da média**, porque a conformidade é indefinida.
4. **Conformidade da instituição** = média simples das páginas da coleta avaliadas com sucesso (todas vêm de rotas confirmadas).
5. **Portal que falhou** (nenhuma página avaliada) = **ausência de dado** (`status: 'no_data'`). Nunca vale 0% e nunca entra em médias entre instituições.
6. **Classificação**: Bom ≥ 75%, Parcial 50–74%, Crítico < 50% (`CONFORMITY_THRESHOLDS` em `packages/contracts`).
7. **Severidade**: `critical`/`serious` → Crítico; `moderate`/`minor` → Moderado. Vale o impacto do elemento; na falta dele, o da regra.
8. **Critérios WCAG**: tags `wcagXYZ` → `X.Y.Z` (ex.: `wcag1412` → 1.4.12). Quando uma regra aponta mais de um critério, `wcag_criteria` guarda a lista em ordem crescente (`"2.4.4, 4.1.2"`) e o **princípio é o do menor critério**. Há **um achado por elemento reprovado**, sem duplicação por critério. No axe-core 4.13.0, as 70 regras das tags usadas têm critério; 5 têm mais de um (area-alt, aria-hidden-body, input-image-alt, link-name, scrollable-region-focusable).
9. **Fingerprint** = SHA-256 de `rule_id`, seletor e `institution_id`. O seletor é normalizado **apenas quanto a espaços**; os índices (`:nth-child`) são mantidos. Cada elemento é um problema, e o mesmo elemento do cabeçalho em várias páginas é o mesmo problema. Seletores que atravessam iframe/shadow DOM são unidos com ` | ` e ` >>> `.
10. **Métrica principal do comparativo** = número de **problemas distintos** (fingerprints). **Ocorrências** (elementos reprovados) são informação secundária. Falsos positivos ficam fora das duas contagens.
11. **Template** = problema presente em **≥ 80%** das páginas avaliadas da instituição (`TEMPLATE_THRESHOLD`), **desde que haja pelo menos 2 páginas avaliadas** (`TEMPLATE_MIN_PAGES`). Com uma página só, todo problema estaria em 100% das páginas.

## Consequências

- Os números cobrem **apenas critérios verificáveis automaticamente**, e toda tela que os exibir precisa dizer isso.
- As mudanças nos limiares são feitas em constantes únicas de `packages/contracts/src/conformity.ts`.
- Mudar a normalização do seletor muda os fingerprints e, portanto, a comparação com coletas anteriores. Se isso acontecer, deve ser um novo ciclo de coletas, como uma atualização do axe (seção 3.2.4).
