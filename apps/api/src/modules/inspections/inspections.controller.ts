import {
  assistiveCheckInputSchema,
  assistiveCheckKinds,
  createTargetTaskSchema,
  findingValidationSchema,
  inspectionSampleUpdateSchema,
  taskInspectionInputSchema,
} from '@auditoria-rf/contracts';
import type { RequestHandler } from 'express';
import { z } from 'zod';
import { parseId } from '../../shared/params.js';
import type { InspectionsService } from './inspections.service.js';

const kindSchema = z.enum(assistiveCheckKinds);

export function createInspectionsController(service: InspectionsService) {
  const auditorId = (req: Parameters<RequestHandler>[0]) => (req.auditor as { id: number }).id;

  const summary: RequestHandler = (req, res) => {
    res.json(service.summary(parseId(req.params.id)));
  };
  const setSample: RequestHandler = (req, res) => {
    const { institutionIds } = inspectionSampleUpdateSchema.parse(req.body);
    const id = parseId(req.params.id);
    service.setSample(id, institutionIds, auditorId(req));
    res.json(service.summary(id));
  };
  const findings: RequestHandler = (req, res) => {
    res.json(service.findings(parseId(req.params.id), parseId(req.params.institutionId)));
  };
  const incomplete: RequestHandler = async (req, res) => {
    res.json(await service.incomplete(parseId(req.params.id), parseId(req.params.institutionId)));
  };
  const validate: RequestHandler = (req, res) => {
    const finding = service.validate(
      parseId(req.params.id),
      findingValidationSchema.parse(req.body),
      auditorId(req),
    );
    res.json({ finding });
  };
  const listTasks: RequestHandler = (_req, res) => {
    res.json({ tasks: service.listTasks() });
  };
  const createTask: RequestHandler = (req, res) => {
    res.status(201).json({ task: service.createTask(createTargetTaskSchema.parse(req.body)) });
  };
  const tasks: RequestHandler = (req, res) => {
    res.json({ tasks: service.tasks(parseId(req.params.id), parseId(req.params.institutionId)) });
  };
  const saveTask: RequestHandler = (req, res) => {
    res.json({
      inspection: service.saveTaskInspection(
        taskInspectionInputSchema.parse(req.body),
        auditorId(req),
      ),
    });
  };
  const assistive: RequestHandler = (req, res) => {
    res.json({
      pages: service.assistive(parseId(req.params.id), parseId(req.params.institutionId)),
    });
  };
  const saveAssistive: RequestHandler = (req, res) => {
    const kind = kindSchema.parse(req.params.kind);
    const check = service.saveAssistiveCheck(
      parseId(req.params.pageId),
      kind,
      assistiveCheckInputSchema.parse(req.body),
      auditorId(req),
    );
    res.json({ check });
  };

  return {
    summary,
    setSample,
    findings,
    incomplete,
    validate,
    listTasks,
    createTask,
    tasks,
    saveTask,
    assistive,
    saveAssistive,
  };
}
