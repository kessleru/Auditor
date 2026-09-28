import type { RequestHandler } from 'express';
import { parseId } from '../../shared/params.js';
import type { IndicatorsService } from './indicators.service.js';
import type { ResultsService } from './results.service.js';

export function createResultsController(service: ResultsService, indicators: IndicatorsService) {
  const overview: RequestHandler = (_req, res) => {
    res.json(service.overview());
  };
  const institution: RequestHandler = (req, res) => {
    res.json(service.detail(parseId(req.params.id)));
  };
  const indicatorsJson: RequestHandler = (_req, res) => {
    res.json(indicators.indicators());
  };
  const rulesCsv: RequestHandler = (_req, res) => {
    res
      .type('text/csv; charset=utf-8')
      .attachment('auditoria-rf-validacao-por-regra.csv')
      .send(indicators.rulesCsv());
  };
  const rulesDictionary: RequestHandler = (_req, res) => {
    res
      .type('text/csv; charset=utf-8')
      .attachment('auditoria-rf-validacao-por-regra-dicionario.csv')
      .send(indicators.rulesDictionary());
  };
  return { overview, institution, indicators: indicatorsJson, rulesCsv, rulesDictionary };
}
