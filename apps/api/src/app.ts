import express from 'express';
import type { HealthResponse } from '@auditoria-rf/contracts';

export function createApp() {
  const app = express();

  app.get('/api/v1/health', (_req, res) => {
    const body: HealthResponse = { status: 'ok', timestamp: new Date().toISOString() };
    res.json(body);
  });

  return app;
}
