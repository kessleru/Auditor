import type { Route } from '@auditoria-rf/contracts';
import type { RouteWithFunction } from './routes.repository.js';

export const toRoute = (row: RouteWithFunction): Route => ({
  id: row.id,
  institutionId: row.institutionId,
  url: row.url,
  normalizedUrl: row.normalizedUrl,
  functionKey: row.functionKey,
  source: row.source,
  status: row.status,
  exclusionReason: row.exclusionReason,
  replacedByRouteId: row.replacedByRouteId,
  discoveredAt: row.discoveredAt.toISOString(),
  confirmedAt: row.confirmedAt?.toISOString() ?? null,
  lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
});
