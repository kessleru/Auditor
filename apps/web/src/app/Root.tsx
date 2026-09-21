import { useEffect, useRef } from 'react';
import { Outlet, ScrollRestoration, useLocation } from 'react-router';

/**
 * Raiz das rotas: a cada troca de rota (não na primeira carga), move o foco para o `<h1>` do
 * conteúdo, para o leitor de tela anunciar a nova página (seção 5.4).
 */
export function Root() {
  const { pathname } = useLocation();
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    document.querySelector<HTMLElement>('main h1')?.focus();
  }, [pathname]);

  return (
    <>
      <Outlet />
      <ScrollRestoration />
    </>
  );
}
