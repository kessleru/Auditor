import { describe, expect, it } from 'vitest';
import { isAuthenticatedArea, isAuthUrl } from './auth-detection.js';

describe('isAuthUrl', () => {
  it.each([
    'https://www.if.edu.br/login?next=/x',
    'https://sso.if.edu.br/realms/if',
    'https://cas.if.edu.br/cas/login',
    'https://www.if.edu.br/auth/entrar',
  ])('reconhece %s', (url) => {
    expect(isAuthUrl(url)).toBe(true);
  });

  it.each([
    'https://www.if.edu.br/casa-do-estudante',
    'https://www.if.edu.br/authors',
    'https://www.if.edu.br/ensino',
  ])('não confunde %s', (url) => {
    expect(isAuthUrl(url)).toBe(false);
  });
});

describe('isAuthenticatedArea', () => {
  it('exige redirecionamento para considerar a URL', () => {
    const finalUrl = 'https://www.if.edu.br/login';
    expect(isAuthenticatedArea({ redirected: false, finalUrl, hasPasswordField: false })).toBe(
      false,
    );
    expect(isAuthenticatedArea({ redirected: true, finalUrl, hasPasswordField: false })).toBe(true);
  });

  it('campo de senha basta', () => {
    expect(
      isAuthenticatedArea({
        redirected: false,
        finalUrl: 'https://www.if.edu.br/x',
        hasPasswordField: true,
      }),
    ).toBe(true);
  });
});
