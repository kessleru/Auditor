# 0014 — Evidência visual dos achados: foto do elemento e amostra de contraste

- **Data:** 2026-09-27
- **Fases:** 4, 8 e 9 (complemento)
- **Situação:** aceita

## Contexto

O card de cada problema mostrava só o seletor e o trecho de HTML. Para saber se um contraste é
mesmo ruim, qual imagem está sem `alt` ou qual link não tem nome, o auditor precisava abrir o
portal e procurar o elemento. Isso atrasa a validação dos achados (ADR 0008) e deixa o relatório
público abstrato para quem não lê HTML.

## Decisões

1. **Foto do elemento na coleta.** Depois do axe e do `page.content()`, o Playwright fotografa
   cada elemento reprovado: recorte com 16 px de margem (para mostrar o fundo e a vizinhança),
   contorno vermelho de destaque, JPEG qualidade 75, altura até 600 px. É uma foto por par (regra,
   seletor) em cada página, no máximo 30 por página. Fica em
   `SNAPSHOTS_DIR/<coleta>/<página>/<achado>.jpg`, com o caminho em `findings.screenshot_path`.
2. **Sem foto** quando o alvo está dentro de iframe ou shadow DOM, quando o elemento está
   invisível ou sem tamanho, ou quando o alvo é a página inteira (`html`, `body`: `lang`, título).
   Foto que falha não falha a página: o achado fica só com o código.
3. **Evidência de contraste.** O axe já mede, para `color-contrast`, as cores do texto e do fundo, a
   razão obtida, a mínima exigida e a fonte. Esses dados vão para `findings.evidence_json`, e a
   interface mostra uma amostra do texto com essas cores e a frase "Razão 2,8:1 — mínimo 4,5:1".
4. **Na interface**, o `FindingPreview` fica acima do código no card, na validação (3.3), nos
   resultados do auditor (4.2) e na visão pública. A amostra de contraste é um SVG: o contraste
   baixo é justamente o defeito ilustrado, e a mesma informação vai escrita ao lado, em texto com
   contraste adequado (a cor nunca é a única informação).
5. **Acesso à foto.** `GET /api/v1/findings/:id/screenshot`: sem sessão, só a de achado
   confirmado, como a visão pública (ADR 0006); o auditor vê qualquer uma.
6. **Nunca injetar o HTML do portal** na página do sistema (risco de script de terceiros). A
   "renderização" é sempre imagem ou SVG gerado a partir de dados medidos.

## Ampliação (28/09/2026)

7. **Mais evidência.** Além do contraste, `target-size` (2.5.8) guarda o tamanho medido pelo axe e
   a distância até o vizinho mais próximo. Para imagem sem texto alternativo (`image-alt`,
   `input-image-alt`), link sem nome (`link-name`) e campo sem rótulo (`label`, `select-name`), o
   navegador lê do elemento o endereço da imagem, o destino do link e o tipo do campo; no
   contraste, a família da fonte calculada (o axe não a informa), que a amostra passa a usar com a
   do sistema de reserva. É uma única leitura no navegador, depois do axe e do snapshot, que só lê.
   Endereços do portal aparecem como texto, nunca como link.
8. **Preenchimento retroativo.** `npm run evidence:backfill` refaz a evidência de contraste e de
   tamanho do alvo das coletas antigas a partir do `.axe.json.gz` salvo; a fonte, a imagem, o link e
   o campo exigem a página aberta e ficam sem. Só completa achados sem evidência: nunca muda a
   validação nem o resultado da coleta.
9. **Foto em tamanho real.** A prévia limita a foto a 320 px de altura e oferece um link para abri-la
   inteira, em nova aba (avisado no próprio texto do link).
10. **Elemento no centro da janela antes da foto.** Rolar só "se precisar" deixava o elemento
    que já estava na janela onde estava, às vezes embaixo de um cabeçalho fixo ou de um aviso de
    cookies no rodapé. Agora ele vai para o centro; continua encoberto só o que está no topo da
    página (não há como rolar acima dele).

## O que não muda

O resultado da auditoria e o HTML salvo são os mesmos: a foto sai depois dos dois, com as mesmas
versões de axe e navegador (seção 3.2). A rolagem até o elemento pode disparar o carregamento
tardio de imagens do portal, que são requisições da própria página já aberta.

## Limitações

Coletas anteriores a esta decisão ficam sem foto e sem evidência: não há como fotografar de novo
a página daquele dia. A foto mostra o elemento na janela de 1280×800 da coleta, e um cabeçalho fixo
pode encobrir parte dele.
