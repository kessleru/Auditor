import type { RequestHandler } from 'express';
import { parseId } from '../../shared/params.js';
import type { PublicReportsService } from './public-reports.service.js';

export function createPublicController(service: PublicReportsService) {
  const summary: RequestHandler = (_req, res) => {
    res.json(service.summary());
  };
  const institutions: RequestHandler = (_req, res) => {
    res.json({ institutions: service.list() });
  };
  const institution: RequestHandler = (req, res) => {
    res.json(service.detail(parseId(req.params.id)));
  };
  const findings: RequestHandler = (req, res) => {
    res.json({ problems: service.problems(parseId(req.params.id)) });
  };
  const methodology: RequestHandler = (_req, res) => {
    res.json(service.methodology());
  };
  return { summary, institutions, institution, findings, methodology };
}
