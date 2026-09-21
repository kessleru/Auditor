import type { Collection, CollectionPage, CollectionProgress } from '@auditoria-rf/contracts';
import type { CollectionPageWithRoute, CollectionRow } from './collections.repository.js';

const iso = (date: Date | null) => date?.toISOString() ?? null;

export const toCollection = (row: CollectionRow, progress: CollectionProgress): Collection => ({
  id: row.id,
  status: row.status,
  scope: row.scope,
  axeVersion: row.axeVersion,
  browserVersion: row.browserVersion,
  userAgent: row.userAgent,
  createdBy: row.createdBy,
  createdAt: row.createdAt.toISOString(),
  startedAt: iso(row.startedAt),
  finishedAt: iso(row.finishedAt),
  progress,
});

export const toCollectionPage = (row: CollectionPageWithRoute): CollectionPage => ({
  id: row.id,
  collectionId: row.collectionId,
  routeId: row.routeId,
  institutionId: row.institutionId,
  url: row.url,
  functionKey: row.functionKey,
  status: row.status,
  httpStatus: row.httpStatus,
  error: row.error,
  passesCount: row.passesCount,
  violationsCount: row.violationsCount,
  incompleteCount: row.incompleteCount,
  inapplicableCount: row.inapplicableCount,
  evaluatedAt: iso(row.evaluatedAt),
});
