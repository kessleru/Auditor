import { auditDraftPositionSchema, saveAuditDraftSchema } from '@auditoria-rf/contracts';
import type { Request, RequestHandler } from 'express';
import { toCollection } from '../collections/collections.presenter.js';
import type { CollectionsService } from '../collections/collections.service.js';
import type { AuditDraftsService } from './audit-drafts.service.js';

const auditorId = (req: Request) => {
  if (!req.auditor) throw new Error('requireAuditor deve preceder a auditoria em montagem.');
  return req.auditor.id;
};

export function createAuditDraftsController(
  service: AuditDraftsService,
  collections: CollectionsService,
) {
  const get: RequestHandler = (req, res) => {
    res.json({ draft: service.get(auditorId(req)) });
  };

  const save: RequestHandler = (req, res) => {
    res.json({ draft: service.save(auditorId(req), saveAuditDraftSchema.parse(req.body)) });
  };

  const move: RequestHandler = (req, res) => {
    res.json({ draft: service.move(auditorId(req), auditDraftPositionSchema.parse(req.body)) });
  };

  const discard: RequestHandler = (req, res) => {
    service.discard(auditorId(req));
    res.status(204).end();
  };

  const start: RequestHandler = (req, res) => {
    const created = service.start(auditorId(req));
    const { collection, progress } = collections.getWithProgress(created.id);
    res.status(201).json({ collection: toCollection(collection, progress) });
  };

  return { get, save, move, discard, start };
}
