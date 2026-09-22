import { type RefObject, useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router';

export interface SlidingNavIndicatorProps {
  container: RefObject<HTMLElement | null>;
  /** Vertical na sidebar do auditor; horizontal na barra do visitante. */
  orientation?: 'vertical' | 'horizontal';
}

/**
 * Fundo do item ativo que desliza até o item escolhido (só `transform`, 220 ms, sob motion-safe).
 * Sem preferência por movimento reduzido ele desliza; com ela, pula direto. É decorativo
 * (`aria-hidden`): o item ativo continua marcado com `aria-current="page"`.
 */
export function SlidingNavIndicator({
  container,
  orientation = 'vertical',
}: SlidingNavIndicatorProps) {
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
    const navBox = nav.getBoundingClientRect();
    const activeBox = active.getBoundingClientRect();
    if (orientation === 'horizontal') {
      el.style.width = `${active.offsetWidth}px`;
      el.style.height = `${active.offsetHeight}px`;
      // translate nos dois eixos: a barra do visitante quebra em duas linhas em telas estreitas.
      el.style.transform = `translate(${activeBox.left - navBox.left}px, ${activeBox.top - navBox.top}px)`;
    } else {
      el.style.height = `${active.offsetHeight}px`;
      el.style.transform = `translateY(${activeBox.top - navBox.top}px)`;
    }
    el.style.opacity = '1';
    // A primeira posição é aplicada sem deslizar; a transição só vale para as trocas seguintes.
    if (!el.dataset.ready) requestAnimationFrame(() => (el.dataset.ready = 'true'));
  }, [container, orientation, pathname]);

  return (
    <span
      ref={indicator}
      aria-hidden="true"
      className={
        orientation === 'horizontal'
          ? 'pointer-events-none absolute top-0 left-0 rounded-md bg-accent-soft opacity-0 motion-safe:data-ready:transition-transform motion-safe:data-ready:duration-[220ms] motion-safe:data-ready:ease-out'
          : 'pointer-events-none absolute top-0 right-0 left-0 rounded-md bg-accent-soft opacity-0 motion-safe:data-ready:transition-transform motion-safe:data-ready:duration-[220ms] motion-safe:data-ready:ease-out'
      }
    />
  );
}
