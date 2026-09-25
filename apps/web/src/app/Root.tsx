import { useEffect, useRef } from 'react';
import { Outlet, ScrollRestoration, useLocation } from 'react-router';

/**
 * Raiz das rotas: a cada troca de rota (não na primeira carga), move o foco para o `<h1>` do
 * conteúdo, para o leitor de tela anunciar a nova página (seção 5.4). Com âncora no endereço
 * (ex.: `/metodologia#comparacao`), o foco vai para o título da seção: focar o `<h1>` levaria a
 * página de volta ao topo.
 */
export function Root() {
  const { pathname, hash } = useLocation();
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const target = hash ? anchorTarget(hash.slice(1)) : null;
    (target ?? document.querySelector<HTMLElement>('main h1'))?.focus();
  }, [pathname, hash]);

  return (
    <>
      <Outlet />
      <ScrollRestoration />
    </>
  );
}

/** Título da seção apontada pela âncora (ou o próprio elemento), pronto para receber foco. */
function anchorTarget(id: string): HTMLElement | null {
  const section = document.getElementById(decodeURIComponent(id));
  if (!section) return null;
  const target = section.querySelector<HTMLElement>('h1, h2, h3') ?? section;
  if (target.tabIndex < 0 && !target.hasAttribute('tabindex'))
    target.setAttribute('tabindex', '-1');
  return target;
}
