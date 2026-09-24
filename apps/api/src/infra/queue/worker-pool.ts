/**
 * Pool de execução com concorrência limitada. A fila em si é persistida no banco
 * (`collection_pages`); o pool só pede o próximo trabalho (`claim`) enquanto houver vaga.
 */
export interface WorkerPoolOptions<Job> {
  concurrency: number;
  claim: () => Promise<Job | null>;
  process: (job: Job) => Promise<void>;
  onError?: (err: unknown, job: Job) => void;
  onClaimError?: (err: unknown) => void;
}

export function createWorkerPool<Job>({
  concurrency,
  claim,
  process,
  onError,
  onClaimError,
}: WorkerPoolOptions<Job>) {
  let active = 0;
  let filling: Promise<void> | null = null;
  let refillRequested = false;
  const idleWaiters: (() => void)[] = [];

  const notifyIdle = () => {
    if (active === 0 && !filling) idleWaiters.splice(0).forEach((resolve) => resolve());
  };

  const fill = async () => {
    do {
      refillRequested = false;
      while (active < concurrency) {
        let job: Job | null;
        try {
          job = await claim();
        } catch (err) {
          // Um erro ao reivindicar não pode escapar: rejeição sem tratamento derruba o processo.
          onClaimError?.(err);
          break;
        }
        if (job === null) break;
        active++;
        void process(job)
          .catch((err: unknown) => onError?.(err, job))
          .finally(() => {
            active--;
            kick();
          });
      }
    } while (refillRequested);
  };

  function kick(): void {
    if (filling) {
      refillRequested = true;
      return;
    }
    filling = fill().finally(() => {
      filling = null;
      notifyIdle();
    });
  }

  return {
    kick,
    get active() {
      return active;
    },
    /** Resolve quando não há trabalho em execução nem por reivindicar. */
    idle(): Promise<void> {
      return new Promise((resolve) => {
        idleWaiters.push(resolve);
        notifyIdle();
      });
    },
  };
}
