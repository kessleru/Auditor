import path from 'node:path';

/** Onde a sessão do auditor fica guardada entre os testes (fora do controle de versão). */
export const ARQUIVO_SESSAO = path.join(import.meta.dirname, '.auth', 'auditor.json');

const email = process.env.E2E_AUDITOR_EMAIL;
const senha = process.env.E2E_AUDITOR_PASSWORD;

/** Sem credenciais no ambiente, os testes que dependem de sessão são pulados. */
export const CREDENCIAIS = email && senha ? { email, senha } : null;
