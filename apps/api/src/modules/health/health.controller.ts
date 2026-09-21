import type { RequestHandler } from 'express';
import type { HealthResponse } from '@auditoria-rf/contracts';

export const getHealth: RequestHandler = (_req, res) => {
  const body: HealthResponse = { status: 'ok', timestamp: new Date().toISOString() };
  res.json(body);
};
