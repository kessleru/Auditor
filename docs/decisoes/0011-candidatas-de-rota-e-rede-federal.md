# 0011 — Candidatas de rota por relevância, Rede Federal no seed e ajustes do motor

- **Data:** 2026-09-24
- **Fases:** 3, 4, 7 e 8 (revisão)
- **Situação:** aceita

## Contexto

Na revisão de rotas, a sugestão exibida para cada função era a primeira em ordem alfabética, e a escolha de outra URL era uma lista sem ordem de até 200 endereços. No modo sitemap, os links do menu da página inicial eram ignorados, e portais em ISO-8859-1 perdiam os acentos do título (e, com eles, as palavras-chave). O autor também pediu a Rede Federal inteira cadastrada por padrão, para não precisar procurar os domínios dos institutos.

## Decisões

1. **Rede Federal no seed.** Os 38 institutos federais, os dois CEFETs, a UTFPR e o Colégio Pedro II entram no `db:seed`, com o IFTM primeiro (id 1). Instituição já cadastrada com o mesmo domínio ou a mesma sigla não é duplicada nem alterada. As escolas técnicas vinculadas às universidades ficam de fora: o portal delas é um subdomínio da universidade e entra pelo cadastro. Os domínios são os dos portais institucionais; a descoberta segue os redirecionamentos (ex.: `ifba.edu.br` → `portal.ifba.edu.br`). O plano previa só o IFTM (Fase 1); a mudança foi pedida pelo autor.
2. **Links da página inicial também no modo sitemap.** O menu é o melhor indício das páginas de cada função, e sitemaps de CMS costumam trazer sobretudo notícias. A ordem continua robots → sitemap → crawler; com sitemap, a página inicial é lida (já era) e os links dela entram como candidatas, ao lado das URLs do sitemap, sem seguir os links das outras páginas. Cada rota guarda a própria origem: `sitemap` se veio do sitemap, `crawler` se veio de um link.
3. **Relevância da sugestão (0–100)**, em `suggestionRelevance` (`infra/crawler/suggest-function.ts`): termo da função no caminho (+40), no título (+25) e no texto do link (+25); link de menu (+15); link direto da página inicial (+10); caminho curto (+15/+10/+5); notícia, evento, listagem ou caminho com data (−35); parâmetros na URL (−10). Ela **só ordena**: as visitas quando o teto de URLs aperta (dentro de cada nível, no crawler) e as candidatas na revisão. A decisão continua do auditor (seção 3.1.4).
4. **Termos de exclusão** (`not` em `FUNCTION_KEYWORDS`): processo seletivo de professor substituto, docentes, servidores, estagiários e bolsistas não é ingresso de estudante; edital de pesquisa, extensão ou iniciação científica não é edital de auxílio. Foram acrescentadas variações comuns (`processoseletivo`, `vestibulinho`, "política de assistência estudantil" etc.).
5. **Subdomínios da instituição** linkados pelo portal (ex.: `biblioteca.if.edu.br`) viram sugestão **sem ser acessados**, se o link sugere uma função, como já acontecia com os de homologação (ADR 0002, item 8). O rastreamento continua na mesma origem (seção 3.1.3).
6. **Mesmo site com outro endereço.** Links com `http://` ou com/sem `www.` em relação à origem canônica são reescritos para ela, em vez de descartados. A normalização também tira `index.html`/`index.php` do fim do caminho, `jsessionid`/`PHPSESSID` e ordena os parâmetros.
7. **Armadilhas de rastreamento** (busca, feed, impressão, `wp-json`, `?s=`, `?tmpl=`...) não são visitadas: consumiriam o teto sem valor para a pesquisa.
8. **Codificação.** O HTML é decodificado pelo charset do cabeçalho ou do `<meta charset>`; sem declaração, UTF-8.
9. **Sitemap.** Com o sitemap declarado quebrado ou vazio, a descoberta tenta os caminhos padrão. Num índice, sitemaps de páginas são lidos antes dos de notícias.
10. **Título, texto do link e relevância** ficam gravados na rota (migration 0003, colunas `title`, `link_text`, `relevance`), como previsto na ADR 0002 ("se a tela 1.2 precisar dele"). A cada descoberta eles são atualizados; decisões do auditor nunca. Se o auditor mudou a função, a relevância antiga é mantida.
11. **Motor de auditoria.** A versão gravada na coleta é a do axe-core que o `@axe-core/playwright` injeta (resolvida a partir dele), e cada página confere com `results.testEngine.version`: divergência vira falha, nunca dado com versão errada. Resposta que não é HTML (PDF, download) vira falha com motivo. As falhas ganham mensagem em português com o código técnico. O contexto do navegador usa `locale: 'pt-BR'`.
12. **Tarefa-alvo.** O cronômetro mede pelo relógio (o navegador desacelera temporizadores em abas em segundo plano, justamente quando o auditor executa a tarefa em outra janela) e para no limite; interações não passam de 15. A API recusa tarefa concluída acima de 5 min ou 15 interações: pelo critério de parada (ADR 0008), ela foi interrompida.
13. **`npm run discover`** executa a descoberta pela CLI, com os mesmos services da API, para uma instituição ou todas (`--all`), e imprime as candidatas mais relevantes por função. Serve para testar contra os portais reais; nada é confirmado.

## Consequências

- Rotas descobertas antes desta mudança ficam com relevância vazia até a próxima descoberta.
- A contagem `blockedByRobots` passou a contar URLs distintas.
- Os testes seguem sem rede: portais falsos em memória (`__fixtures__/site.ts`) e HTML servido em `127.0.0.1`.
