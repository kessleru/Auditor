# 0001 — Sessão do auditor em tabela própria

- **Data:** 2026-09-21
- **Fase:** 2 — Autenticação do auditor
- **Situação:** aceita

## Contexto

O plano pede sessão em cookie `httpOnly`, `secure` em produção e `sameSite=lax`, mas o modelo de dados (seção 2) não define onde a sessão fica. As opções eram um cookie assinado sem estado no servidor ou uma tabela de sessões.

## Decisão

- Tabela `sessions (id, user_id, token_hash UNIQUE, created_at, expires_at)`, fora da lista original da seção 2.
- O cookie `auditoria_session` leva um token aleatório de 256 bits; o banco guarda **só o SHA-256** dele. Vazamento do banco não permite reutilizar sessões.
- Validade fixa de 12 horas (jornada de inspeção manual). Sessões expiradas são apagadas a cada novo login.
- Logout apaga a sessão no servidor, não apenas o cookie.
- Cookie com `path=/api`: só é enviado para a API.
- Senhas com argon2id; mínimo de 12 caracteres. Auditor criado apenas pela CLI `npm run create-auditor`.
- Rate limit do login: 5 tentativas **malsucedidas** a cada 15 minutos por IP; logins bem-sucedidos não contam.
- Login com e-mail inexistente executa uma verificação argon2 fictícia e devolve a mesma mensagem da senha errada, para não revelar quais e-mails existem.

## Consequências

- `SESSION_SECRET` deixou de ser necessário e saiu do `.env.example`.
- Sessões podem ser revogadas individualmente (logout) ou todas de um auditor (apagar as linhas).
- O rate limit guarda contagens em memória: reinício do servidor zera os contadores. Aceitável para uma instância única; atrás de proxy reverso será preciso configurar `trust proxy` (Fase 11).
