import type { RequestHandler } from 'express';
import { parseId } from '../../shared/params.js';
import type { ResultsService } from './results.service.js';

export function createResultsController(service: ResultsService) {
  const overview: RequestHandler = (_req, res) => {
    res.json(service.overview());
  };
  const institution: RequestHandler = (req, res) => {
    res.json(service.detail(parseId(req.params.id)));
  };
  return { overview, institution };
}
