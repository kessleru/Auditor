import { type AuthUserResponse, loginRequestSchema } from '@auditoria-rf/contracts';
import type { RequestHandler } from 'express';
import type { AuthService } from './auth.service.js';
import { readSessionToken, SESSION_COOKIE, sessionCookieOptions } from './session-cookie.js';

export function createAuthController(
  authService: AuthService,
  { secureCookies }: { secureCookies: boolean },
) {
  const cookieOptions = sessionCookieOptions(secureCookies);

  const login: RequestHandler = async (req, res) => {
    const input = loginRequestSchema.parse(req.body);
    const { user, token, expiresAt } = await authService.login(input);
    res.cookie(SESSION_COOKIE, token, { ...cookieOptions, expires: expiresAt });
    const body: AuthUserResponse = { user };
    res.json(body);
  };

  const logout: RequestHandler = (req, res) => {
    authService.logout(readSessionToken(req));
    res.clearCookie(SESSION_COOKIE, cookieOptions);
    res.status(204).end();
  };

  const me: RequestHandler = (req, res) => {
    if (!req.auditor) throw new Error('requireAuditor deve preceder /auth/me.');
    const body: AuthUserResponse = { user: req.auditor };
    res.json(body);
  };

  return { login, logout, me };
}
