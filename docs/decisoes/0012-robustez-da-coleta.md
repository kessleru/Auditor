# 0012 — Robustez: rede, TLS, robots.txt, navegador, sessão e launcher

- **Data:** 2026-09-24
- **Fases:** 2, 3, 4 e 12 (revisão)
- **Situação:** aceita

## Contexto

Revisão procurando o que faria a pesquisa perder dado sem necessidade: portal que abre no navegador mas não no crawler, servidor que cai por um erro do navegador, sessão que não abre na demonstração em contêiner, launcher sem e-mail de contato. As regras da seção 3 não mudam: o user-agent segue identificável, o intervalo de 1,5 s por host e a trava por domínio continuam valendo.

## Decisões

1. **Nova tentativa no crawler** (uma): falha de rede passageira e HTTP 429/503, esperando o `Retry-After` do servidor (até 30 s; acima disso, a resposta volta como veio). O intervalo por host vale também para a nova tentativa.
2. **Cadeia TLS incompleta.** Quando o servidor não manda a intermediária, a descoberta a baixa pelo AIA do certificado, como o navegador faz, e só a aceita se a cadeia fechar numa raiz confiável do Node. O nome do host continua conferido pelo TLS. Antes, a descoberta falhava em portais que o Chromium da coleta abria normalmente.
3. **`www.`** Domínio que não responde sem `www.` é tentado com `www.`.
4. **robots.txt com 5xx ou 429, ou inacessível por erro de rede** (conexão recusada, tempo esgotado, TLS), interrompe a descoberta com explicação: pela RFC 9309 (2.3.1.4), robots.txt inacessível significa tudo proibido. 4xx segue liberando tudo (ADR 0002).
5. **Limites da descoberta:** para após 10 falhas seguidas (o portal parou de responder ou passou a bloquear: não insistir) ou 20 minutos, guardando o que já encontrou; a interface e a CLI dizem o motivo (`stoppedEarly`).
6. **Proxy institucional** (`CRAWLER_PROXY`): crawler e navegador da coleta saem pelo proxy da rede do campus quando ela não tem saída direta. Com proxy, a cadeia TLS não é completada pelo AIA.
7. **Navegador que cai** é descartado e reaberto na página seguinte; a tentativa extra da seção 3.2.1 vale também para queda do navegador e para página que redireciona por script durante a análise. Navegador que não abre no início da coleta deixa a coleta **parcial**, com o motivo em cada página, e libera a trava do domínio; antes, a rejeição escapava do pool e derrubava o servidor. "Tentar de novo" a reabre.
8. **Sessão atrás de proxy reverso** (previsto na ADR 0001): `TRUST_PROXY` configura o `trust proxy` do Express (o `docker/` usa `uniquelocal`), e o limite de login passa a contar o IP de quem acessa. `COOKIE_SECURE=auto` (padrão) marca o cookie `Secure` quando o acesso é por HTTPS. O plano pede `secure` em produção; em produção servida por HTTPS isso continua valendo. Muda só o acesso por HTTP simples, como a demonstração em contêiner aberta pela rede local, onde o cookie `Secure` era descartado pelo navegador e o login nunca abria a sessão.
9. **Contato do user-agent:** sem `CRAWLER_CONTACT_EMAIL`, vale o e-mail do primeiro auditor (o pesquisador responsável), resolvido a cada uso. Quem sobe pelo launcher cria o auditor com a API no ar e já pode descobrir e coletar. O contato público do site continua sendo só o do `.env`.
10. **Launcher:** mensagens diretas para porta ocupada, disco cheio, Docker parado e falta de internet; o seed do banco tem o resultado conferido; nome e e-mail do auditor não aceitam aspas.

## O que não fazer

Portal que bloqueia a ferramenta (HTTP 403, firewall de aplicação) **não é contornado**: trocar o user-agent por um de navegador, variar IPs ou ignorar o robots.txt feriria a seção 3.1 e a ética da coleta. O caminho é registrar o portal como ausência de dado e, se fizer sentido, pedir à equipe de TI da instituição que libere o user-agent `AuditoriaRF` (o contato está nele).

## Pendente de decisão

`waitUntil: 'networkidle'` (seção 3.2.1) nunca termina em páginas com conexões permanentes (chat, vídeo, analytics que não param); elas falham por tempo esgotado e viram ausência de dado. Alternativa: esperar o `load` e, depois, até 30 s pelo `networkidle`, auditando mesmo sem ele e registrando isso na página. É mudança de método; fica para decisão do autor.
