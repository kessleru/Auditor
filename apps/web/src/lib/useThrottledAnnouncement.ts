import { useEffect, useRef, useState } from 'react';

/**
 * Texto para uma região `aria-live="polite"` que muda no máximo uma vez a cada `intervalMs`
 * (padrão 10 s), para não sobrecarregar quem usa leitor de tela. A última mensagem sempre chega.
 */
export function useThrottledAnnouncement(message: string, intervalMs = 10_000): string {
  const [announced, setAnnounced] = useState(message);
  const lastAt = useRef(0);

  useEffect(() => {
    if (message === announced) return;
    const wait = Math.max(0, lastAt.current + intervalMs - Date.now());
    const timer = setTimeout(() => {
      lastAt.current = Date.now();
      setAnnounced(message);
    }, wait);
    return () => clearTimeout(timer);
  }, [message, announced, intervalMs]);

  return announced;
}
