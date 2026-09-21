import { toSearchText } from './suggest-function.js';

// Área autenticada (seção 3.1.5): redirecionamento para URL com login/auth/sso/cas, ou
// formulário com campo de senha. Os termos são comparados como palavras inteiras do host e do
// caminho, para "cas" não casar com "casa".
const AUTH_TERMS = new Set(['login', 'auth', 'sso', 'cas']);

export function isAuthUrl(url: string): boolean {
  const { hostname, pathname } = new URL(url);
  return toSearchText(`${hostname} ${pathname}`)
    .split(' ')
    .some((word) => AUTH_TERMS.has(word));
}

export function isAuthenticatedArea(page: {
  redirected: boolean;
  finalUrl: string;
  hasPasswordField: boolean;
}): boolean {
  return page.hasPasswordField || (page.redirected && isAuthUrl(page.finalUrl));
}
