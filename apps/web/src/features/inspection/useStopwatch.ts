import { useCallback, useEffect, useState } from 'react';

/**
 * Cronômetro da tarefa-alvo medido pelo relógio, não por contagem de `setInterval`: o auditor
 * executa a tarefa em outra janela, e o navegador desacelera os temporizadores da aba em segundo
 * plano (até um disparo por minuto). Para sozinho ao chegar a `limitSeconds`.
 */
export function useStopwatch(initialSeconds: number, limitSeconds: number) {
  const [accumulated, setAccumulated] = useState(Math.min(initialSeconds, limitSeconds));
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const running = startedAt !== null;
  const elapsed = running ? accumulated + Math.floor((now - startedAt) / 1000) : accumulated;
  const seconds = Math.min(elapsed, limitSeconds);

  useEffect(() => {
    if (startedAt === null) return;
    const tick = () => {
      const t = Date.now();
      if (accumulated + Math.floor((t - startedAt) / 1000) >= limitSeconds) {
        setAccumulated(limitSeconds);
        setStartedAt(null);
      } else {
        setNow(t);
      }
    };
    const timer = setInterval(tick, 250);
    // Ao voltar para a aba, atualiza na hora, sem esperar o próximo disparo.
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [startedAt, accumulated, limitSeconds]);

  const start = useCallback(() => {
    if (seconds >= limitSeconds) return;
    const t = Date.now();
    setNow(t);
    setStartedAt(t);
  }, [seconds, limitSeconds]);

  const pause = useCallback(() => {
    setAccumulated(seconds);
    setStartedAt(null);
  }, [seconds]);

  const reset = useCallback(() => {
    setAccumulated(0);
    setStartedAt(null);
  }, []);

  return { seconds, running, limitReached: seconds >= limitSeconds, start, pause, reset };
}
