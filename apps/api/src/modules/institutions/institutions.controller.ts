import { createInstitutionSchema, updateInstitutionSchema } from '@auditoria-rf/contracts';
import type { RequestHandler } from 'express';
import { parseId } from '../../shared/params.js';
import { toInstitution } from './institutions.presenter.js';
import type { InstitutionsService } from './institutions.service.js';

export function createInstitutionsController(service: InstitutionsService) {
  const list: RequestHandler = (_req, res) => {
    res.json({ institutions: service.list().map(toInstitution) });
  };

  const get: RequestHandler = (req, res) => {
    res.json({ institution: toInstitution(service.get(parseId(req.params.id))) });
  };

  const create: RequestHandler = (req, res) => {
    res.status(201).json({
      institution: toInstitution(service.create(createInstitutionSchema.parse(req.body))),
    });
  };

  const update: RequestHandler = (req, res) => {
    res.json({
      institution: toInstitution(
        service.update(parseId(req.params.id), updateInstitutionSchema.parse(req.body)),
      ),
    });
  };

  return { list, get, create, update };
}
