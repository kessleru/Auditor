import type { RequestHandler } from 'express';
import { z } from 'zod';
import { type ExportService, exportDatasets } from './export.service.js';
import { parseId } from '../../shared/params.js';
import type { PublicReportsService } from './public-reports.service.js';

const datasetSchema = z.object({ conjunto: z.enum(exportDatasets).default('instituicoes') });

export function createPublicController(service: PublicReportsService, exporter: ExportService) {
  const summary: RequestHandler = (_req, res) => {
    res.json(service.summary());
  };
  const institutions: RequestHandler = (_req, res) => {
    const { institutions: rows, core } = service.snapshot();
    res.json({ institutions: rows, coreFunctions: core });
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
  const exportCsv: RequestHandler = (req, res) => {
    const { conjunto } = datasetSchema.parse(req.query);
    res
      .type('text/csv; charset=utf-8')
      .attachment(`auditoria-rf-${conjunto}.csv`)
      .send(exporter.csv(conjunto));
  };
  const dictionary: RequestHandler = (_req, res) => {
    res
      .type('text/csv; charset=utf-8')
      .attachment('auditoria-rf-dicionario.csv')
      .send(exporter.dictionary());
  };
  return { summary, institutions, institution, findings, methodology, exportCsv, dictionary };
}
