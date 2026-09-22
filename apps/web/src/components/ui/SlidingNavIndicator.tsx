import { type RefObject, useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router';

/**
 * Fundo do item ativo que desliza até o item escolhido (só `transform`, 220 ms, sob motion-safe).
 * Sem preferência por movimento reduzido ele desliza; com ela, pula direto. É decorativo
 * (`aria-hidden`): o item ativo continua marcado com `aria-current="page"`.
 */
export function SlidingNavIndicator({ container }: { container: RefObject<HTMLElement | null> }) {
  const indicator = useRef<HTMLSpanElement>(null);
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    const nav = container.current;
    const el = indicator.current;
    if (!nav || !el) return;
    const active = nav.querySelector<HTMLElement>('a[aria-current="page"]');
    if (!active) {
      el.style.opacity = '0';
      return;
    }
    const top = active.getBoundingClientRect().top - nav.getBoundingClientRect().top;
    el.style.height = `${active.offsetHeight}px`;
    el.style.transform = `translateY(${top}px)`;
    el.style.opacity = '1';
    // A primeira posição é aplicada sem deslizar; a transição só vale para as trocas seguintes.
    if (!el.dataset.ready) requestAnimationFrame(() => (el.dataset.ready = 'true'));
  }, [container, pathname]);

  return (
    <span
      ref={indicator}
      aria-hidden="true"
      className="pointer-events-none absolute top-0 right-0 left-0 rounded-md bg-accent-soft opacity-0 before:absolute before:top-1.5 before:bottom-1.5 before:left-0 before:w-[3px] before:rounded-full before:bg-accent motion-safe:data-ready:transition-transform motion-safe:data-ready:duration-[220ms] motion-safe:data-ready:ease-out"
    />
  );
}
