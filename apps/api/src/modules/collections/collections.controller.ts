import {
  collectionEventTypes,
  collectionListQuerySchema,
  createCollectionSchema,
} from '@auditoria-rf/contracts';
import type { RequestHandler } from 'express';
import { parseId } from '../../shared/params.js';
import { toCollection, toCollectionPage } from './collections.presenter.js';
import type { CollectionsService } from './collections.service.js';

export const SSE_HEARTBEAT_MS = 15_000;

export function createCollectionsController(
  service: CollectionsService,
  { heartbeatMs = SSE_HEARTBEAT_MS }: { heartbeatMs?: number } = {},
) {
  const create: RequestHandler = (req, res) => {
    const input = createCollectionSchema.parse(req.body);
    const collection = service.create(input, (req.auditor as { id: number }).id);
    const { progress } = service.getWithProgress(collection.id);
    res.status(201).json({ collection: toCollection(collection, progress) });
  };

  const get: RequestHandler = (req, res) => {
    const { collection, progress, pages, institutions } = service.get(parseId(req.params.id));
    res.json({
      collection: toCollection(collection, progress),
      institutions,
      pages: pages.map(toCollectionPage),
    });
  };

  const list: RequestHandler = (req, res) => {
    const { status } = collectionListQuerySchema.parse(req.query);
    res.json({
      collections: service.list(status).map(({ collection, progress, institutions }) => ({
        ...toCollection(collection, progress),
        institutions,
      })),
    });
  };
  const cancel: RequestHandler = (req, res) => {
    const { collection, progress } = service.cancel(parseId(req.params.id));
    res.json({ collection: toCollection(collection, progress) });
  };

  const retryPage: RequestHandler = (req, res) => {
    res.json({ page: toCollectionPage(service.retryPage(parseId(req.params.id))) });
  };

  /** Progresso em tempo real (SSE), com heartbeat para manter a conexão aberta. */
  const events: RequestHandler = (req, res) => {
    const id = parseId(req.params.id);
    const unsubscribe = service.subscribe(id, (event) => {
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    });

    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });
    res.write(`retry: 5000\n: eventos: ${collectionEventTypes.join(', ')}\n\n`);

    const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), heartbeatMs);
    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  };

  return { create, get, list, cancel, retryPage, events };
}
