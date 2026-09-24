import type { CookieOptions, Request } from 'express';

export const SESSION_COOKIE = 'auditoria_session';

/**
 * `auto`: `Secure` só quando a requisição chegou por HTTPS. Marcar `Secure` num acesso por HTTP
 * simples (ex.: http://192.168.0.10:8080, a demonstração em contêiner na rede local) faz o
 * navegador descartar o cookie, e o login "funciona" sem nunca abrir a sessão.
 */
export type SecureCookies = boolean | 'auto';

export function sessionCookieOptions(secure: boolean): CookieOptions {
  return { httpOnly: true, secure, sameSite: 'lax', path: '/api' };
}

export const isSecureFor = (setting: SecureCookies, req: Request) =>
  setting === 'auto' ? req.secure : setting;

export function readSessionToken(req: Request): string | undefined {
  const value: unknown = req.cookies?.[SESSION_COOKIE];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
