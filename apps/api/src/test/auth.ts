import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { DB } from '../db/client.js';
import { createAuthRepository } from '../modules/auth/auth.repository.js';
import { createAuthService } from '../modules/auth/auth.service.js';

export const testAuditor = {
  email: 'auditora@iftm.edu.br',
  name: 'Auditora',
  password: 'senha-bem-longa-123',
};

/**
 * Cria o auditor de teste (se ainda não existe no banco) e devolve um agente do Supertest já com a
 * sessão. Duas instâncias da API sobre o mesmo banco (reinício) usam o mesmo auditor.
 */
export async function loggedInAgent(app: App, db: DB) {
  const repo = createAuthRepository(db);
  if (!repo.findUserByEmail(testAuditor.email)) {
    await createAuthService(repo).createAuditor(testAuditor);
  }
  const agent = request.agent(app);
  const res = await agent
    .post('/api/v1/auth/login')
    .send({ email: testAuditor.email, password: testAuditor.password });
  if (res.status !== 200) throw new Error(`Login de teste falhou: ${res.status}`);
  return agent;
}
