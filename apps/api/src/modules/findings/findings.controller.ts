import type { Request, RequestHandler } from 'express';
import { parseId } from '../../shared/params.js';
import type { FindingsService } from './findings.service.js';

export function createFindingsController(
  service: FindingsService,
  isAuditor: (req: Request) => boolean,
) {
  const screenshot: RequestHandler = async (req, res) => {
    const image = await service.screenshot(parseId(req.params.id), { auditor: isAuditor(req) });
    res.type('image/jpeg').set('Cache-Control', 'private, max-age=300').send(image);
  };
  return { screenshot };
}
