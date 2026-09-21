export interface Clock {
  now(): number;
  sleep(ms: number): Promise<void>;
}

export const systemClock: Clock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

/**
 * Garante um intervalo mínimo entre o início de requisições ao mesmo host (seção 3.1.3),
 * enfileirando as chamadas concorrentes. Uma instância compartilhada vale para o processo todo.
 */
export class HostThrottle {
  private readonly lastStart = new Map<string, number>();
  private readonly tail = new Map<string, Promise<void>>();

  constructor(private readonly clock: Clock = systemClock) {}

  wait(host: string, intervalMs: number): Promise<void> {
    const previous = this.tail.get(host) ?? Promise.resolve();
    const turn = previous.then(async () => {
      const last = this.lastStart.get(host);
      if (last !== undefined) {
        const elapsed = this.clock.now() - last;
        if (elapsed < intervalMs) await this.clock.sleep(intervalMs - elapsed);
      }
      this.lastStart.set(host, this.clock.now());
    });
    this.tail.set(host, turn);
    return turn;
  }
}

export const sharedHostThrottle = new HostThrottle();
