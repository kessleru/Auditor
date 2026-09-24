import { authUserResponseSchema } from '@auditoria-rf/contracts';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import type { DB } from '../../db/client.js';
import { createTestDatabase } from '../../test/db.js';
import { createAuthRepository } from './auth.repository.js';
import { createAuthService, SESSION_TTL_MS } from './auth.service.js';
import { SESSION_COOKIE } from './session-cookie.js';

const auditor = {
  email: 'auditora@iftm.edu.br',
  name: 'Auditora',
  password: 'senha-bem-longa-123',
};

let db: DB;
let now: Date;

beforeEach(async () => {
  db = createTestDatabase();
  now = new Date('2026-09-21T12:00:00Z');
  await createAuthService(createAuthRepository(db)).createAuditor(auditor);
});

function buildApp(
  options: { secureCookies?: boolean | 'auto'; trustProxy?: boolean | number | string } = {},
) {
  return createApp({ db, secureCookies: false, clock: () => now, ...options });
}

function sessionCookie(res: request.Response): string {
  const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
  const cookie = cookies.find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  if (!cookie) throw new Error('Cookie de sessão ausente.');
  return cookie;
}

const login = (app: ReturnType<typeof buildApp>, body: object) =>
  request(app).post('/api/v1/auth/login').send(body);

describe('POST /api/v1/auth/login', () => {
  it('com credenciais válidas, abre a sessão em cookie httpOnly e sameSite=lax', async () => {
    const res = await login(buildApp(), { email: auditor.email, password: auditor.password });

    expect(res.status).toBe(200);
    expect(authUserResponseSchema.parse(res.body).user).toMatchObject({
      email: auditor.email,
      name: auditor.name,
    });
    expect(JSON.stringify(res.body)).not.toMatch(/hash|senha/i);

    const cookie = sessionCookie(res);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(cookie).not.toMatch(/Secure/);
  });

  it('aceita o e-mail com maiúsculas e espaços', async () => {
    const res = await login(buildApp(), {
      email: '  AUDITORA@iftm.edu.br',
      password: auditor.password,
    });
    expect(res.status).toBe(200);
  });

  it('marca o cookie como secure quando configurado (produção)', async () => {
    const res = await login(buildApp({ secureCookies: true }), {
      email: auditor.email,
      password: auditor.password,
    });
    expect(sessionCookie(res)).toMatch(/Secure/);
  });

  it('em auto, marca secure só quando a requisição chegou por HTTPS (via proxy confiável)', async () => {
    const app = buildApp({ secureCookies: 'auto', trustProxy: 'loopback' });
    const plain = await login(app, { email: auditor.email, password: auditor.password });
    expect(sessionCookie(plain)).not.toMatch(/Secure/);

    const viaTls = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-Proto', 'https')
      .send({ email: auditor.email, password: auditor.password });
    expect(sessionCookie(viaTls)).toMatch(/Secure/);
  });

  it('sem proxy confiável, ignora X-Forwarded-Proto', async () => {
    const res = await request(buildApp({ secureCookies: 'auto' }))
      .post('/api/v1/auth/login')
      .set('X-Forwarded-Proto', 'https')
      .send({ email: auditor.email, password: auditor.password });
    expect(sessionCookie(res)).not.toMatch(/Secure/);
  });

  it('com senha errada, responde 401 sem abrir sessão', async () => {
    const res = await login(buildApp(), { email: auditor.email, password: 'senha-errada-000' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('com e-mail desconhecido, responde com a mesma mensagem da senha errada', async () => {
    const app = buildApp();
    const unknown = await login(app, { email: 'ninguem@iftm.edu.br', password: auditor.password });
    const wrong = await login(app, { email: auditor.email, password: 'senha-errada-000' });
    expect(unknown.status).toBe(401);
    expect(unknown.body).toEqual(wrong.body);
  });

  it('valida o corpo da requisição', async () => {
    const res = await login(buildApp(), { email: 'não-é-email' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('bloqueia após 5 tentativas malsucedidas, mesmo com a senha certa', async () => {
    const app = buildApp();
    for (let i = 0; i < 5; i++) {
      expect((await login(app, { email: auditor.email, password: `errada-${i}` })).status).toBe(
        401,
      );
    }
    const res = await login(app, { email: auditor.email, password: auditor.password });
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('TOO_MANY_ATTEMPTS');
  });

  it('atrás de proxy confiável, conta as tentativas por IP de origem, não pelo do proxy', async () => {
    const app = buildApp({ trustProxy: 'loopback' });
    const from = (ip: string, password: string) =>
      request(app)
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', ip)
        .send({ email: auditor.email, password });
    for (let i = 0; i < 5; i++) expect((await from('10.0.0.1', `errada-${i}`)).status).toBe(401);
    expect((await from('10.0.0.1', auditor.password)).status).toBe(429);
    // Outra pessoa atrás do mesmo proxy não fica bloqueada.
    expect((await from('10.0.0.2', auditor.password)).status).toBe(200);
  });

  it('não conta logins bem-sucedidos no limite', async () => {
    const app = buildApp();
    for (let i = 0; i < 6; i++) {
      expect((await login(app, { email: auditor.email, password: auditor.password })).status).toBe(
        200,
      );
    }
  });
});

describe('rota protegida GET /api/v1/auth/me', () => {
  it('sem sessão, responde 401', async () => {
    const res = await request(buildApp()).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('com token inválido, responde 401', async () => {
    const res = await request(buildApp())
      .get('/api/v1/auth/me')
      .set('Cookie', `${SESSION_COOKIE}=token-inventado`);
    expect(res.status).toBe(401);
  });

  it('com sessão válida, devolve o auditor', async () => {
    const app = buildApp();
    const cookie = sessionCookie(await login(app, auditor));
    const res = await request(app).get('/api/v1/auth/me').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(auditor.email);
  });

  it('com sessão expirada, responde 401', async () => {
    const app = buildApp();
    const cookie = sessionCookie(await login(app, auditor));
    now = new Date(now.getTime() + SESSION_TTL_MS + 1);
    const res = await request(app).get('/api/v1/auth/me').set('Cookie', cookie);
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/auth/logout', () => {
  it('encerra a sessão no servidor e apaga o cookie', async () => {
    const app = buildApp();
    const cookie = sessionCookie(await login(app, auditor));

    const res = await request(app).post('/api/v1/auth/logout').set('Cookie', cookie);
    expect(res.status).toBe(204);
    expect(sessionCookie(res)).toMatch(/Expires=Thu, 01 Jan 1970/);

    const me = await request(app).get('/api/v1/auth/me').set('Cookie', cookie);
    expect(me.status).toBe(401);
  });

  it('sem sessão, responde 204', async () => {
    expect((await request(buildApp()).post('/api/v1/auth/logout')).status).toBe(204);
  });
});
