# 0016 — Portal atrás de proteção contra robôs: falha explicada, nunca outro site

- **Data:** 2026-09-28
- **Fases:** 3 e 4 (revisão)
- **Situação:** aceita

## Contexto

Na coleta de demonstração de 28/09/2026, IFTM e IFMG responderam ao user-agent da ferramenta com
302 para `validate.perfdrive.com`, o desafio do Radware Bot Manager (`Server: rdwr`). Três defeitos
apareceram:

1. A descoberta do IFMG seguiu o redirecionamento do `robots.txt` e tomou o domínio do desafio
   como origem do portal (chegou a pedir a página inicial do desafio).
2. A descoberta do IFTM parou por "falhas seguidas" com a mensagem "o portal deixou de responder",
   que esconde o motivo real.
3. A coleta seguia o redirecionamento no navegador: se o desafio carregasse, o axe auditaria a
   página do desafio e gravaria o resultado como se fosse do portal. Na coleta 1 do IFTM, as
   páginas deram tempo esgotado, com a mensagem de lentidão.

Na mesma rodada, o CEFET-MG derrubou a descoberta inteira com "The operation was aborted due to
timeout": o tempo limite estourou na **leitura do corpo** da resposta, fora do tratamento de falha
de rede.

## Decisões

1. **Descoberta:** `robots.txt` ou página inicial que terminam fora do domínio da instituição
   interrompem a descoberta com a explicação (provável proteção contra robôs; a ferramenta não
   contorna; a TI pode liberar o user-agent `AuditoriaRF`). Nenhuma requisição ao domínio de fora
   além da que o próprio redirecionamento fez.
2. **Descoberta:** página que passa a ir para fora do domínio conta como falha (como antes) e o
   domínio fica em `offDomainHost` no resumo; a interface e a CLI dizem "o portal passou a mandar
   a ferramenta para validate.perfdrive.com".
3. **Coleta:** a página que termina fora do domínio da instituição (depois do `goto` ou no tempo
   esgotado) vira falha com o motivo, sem auditar: é ausência de dado (seção 3.2.8), nunca o
   resultado de outro site.
4. **Tempo esgotado lendo o corpo** é falha passageira daquela URL (uma nova tentativa, depois
   falha da página), não da descoberta.

## O que não fazer

Como na ADR 0012: não trocar o user-agent, não resolver o desafio, não variar IP. Portal bloqueado
fica sem dado. As rotas podem ser informadas à mão pelo auditor, mas a coleta vai falhar do mesmo
jeito enquanto a instituição não liberar o user-agent.
