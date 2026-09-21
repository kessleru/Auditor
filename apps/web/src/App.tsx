import { useEffect, useState } from 'react';
import type { HealthResponse } from '@auditoria-rf/contracts';

export function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);

  useEffect(() => {
    fetch('/api/v1/health')
      .then((res) => res.json() as Promise<HealthResponse>)
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  return (
    <main>
      <h1>Auditoria RF</h1>
      <p aria-live="polite">API: {health ? health.status : 'indisponível'}</p>
    </main>
  );
}
