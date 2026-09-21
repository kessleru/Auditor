# 0002 — Descoberta de rotas: detalhes não fixados pelo plano

- **Data:** 2026-09-21
- **Fase:** 3 — Instituições e descoberta de rotas
- **Situação:** aceita

## Contexto

A seção 3.1 do plano fixa as regras gerais (robots → sitemap → crawler, profundidade 2, teto de 200 URLs, 1,5 s por host, sugestão por palavras-chave, detecção de área autenticada). Alguns pontos precisaram de decisão na implementação.

## Decisões

1. **Teto com sitemap grande (decidido com o autor).** A página inicial entra primeiro; depois, as URLs do sitemap cujo caminho sugere alguma função; depois, as demais na ordem do sitemap, até o teto. O objetivo da descoberta é achar as cinco funções, não amostrar o portal.
2. **Sitemap sem URL aproveitável = sem sitemap.** Se o sitemap não traz nenhuma URL da mesma origem, navegável e permitida pelo robots.txt, a descoberta usa o crawler.
3. **O teto limita requisições de página.** Contando a inicial, no máximo 200 páginas são acessadas, mesmo que algumas falhem. Assim a carga no portal fica limitada.
4. **robots.txt.** O robots.txt é lido **antes** da página inicial. Quando existe grupo `User-agent: AuditoriaRF`, ele substitui o grupo `*` (comportamento padrão do protocolo). Um `Crawl-delay` maior que 1,5 s é respeitado, até 30 s. Os arquivos de sitemap declarados no robots.txt são lidos mesmo dentro de caminhos proibidos, porque o próprio portal os indicou.
5. **Sitemap index** percorrido até 2 níveis e no máximo 50 arquivos. O gzip é reconhecido pelo conteúdo, não pela extensão. Só são lidos sitemaps do domínio da instituição.
6. **Palavras-chave (decidido com o autor, listas ampliadas).** Ficam em `FUNCTION_KEYWORDS` (`infra/crawler/suggest-function.ts`). São comparadas sem acento e sem diferenciar maiúsculas, **como palavras inteiras**, no caminho da URL, no título e no texto do link. Uma página recebe no máximo uma sugestão, a da primeira função que casar, nesta ordem: editais de auxílio (exige "edital/editais" + termo de auxílio), ingresso, assistência estudantil, biblioteca. A raiz do site é sempre `home`.
7. **Área autenticada.** Os termos `login`, `auth`, `sso` e `cas` são comparados como palavras inteiras do host e do caminho, para "cas" não casar com "casa". Um redirecionamento para esse tipo de URL marca como autenticada a URL **pedida**, mesmo que o login esteja em outro host (SUAP, SSO). Os links de páginas autenticadas não são seguidos.
8. **Homologação.** Links para subdomínios da instituição com prefixo de desenvolvimento/homologação são gravados como rota `excluded`, com o motivo, sem serem acessados. O cadastro de instituição recusa esses domínios.
9. **Redirecionamentos** são seguidos manualmente (até 5), e cada salto respeita o intervalo por host. A rota gravada é a URL final normalizada.
10. **Nova descoberta** só acrescenta rotas novas e atualiza `last_seen_at` das conhecidas. Decisões do auditor (confirmar, excluir, função) nunca são alteradas. A única exceção é uma sugestão ainda não revisada que passou a exigir login: ela vira `authenticated`.
11. **Execução em segundo plano.** `POST /institutions/:id/discover` responde 202. O andamento fica em memória e é consultado em `GET /institutions/:id/discovery` (endpoint acrescentado ao plano). Só há uma descoberta por instituição de cada vez. O intervalo por host vale para o processo inteiro. A trava por domínio entre coletas é da Fase 4 (`infra/locks`).
12. **Contato obrigatório.** Sem `CRAWLER_CONTACT_EMAIL`, a descoberta responde 503 em vez de sair com user-agent incompleto.

## Consequências

- A lista de palavras-chave afeta só **sugestões**: toda rota passa pela confirmação do auditor antes de entrar numa coleta.
- O título da página é usado na sugestão, mas não é gravado (o modelo de dados não tem essa coluna). Se a tela 1.2 precisar dele, a mudança será uma migration na Fase 7.
