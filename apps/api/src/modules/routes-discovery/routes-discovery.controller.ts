import {
  createRouteSchema,
  replaceRouteSchema,
  routeListQuerySchema,
  updateRouteSchema,
} from '@auditoria-rf/contracts';
import type { RequestHandler } from 'express';
import { parseId } from '../../shared/params.js';
import type { DiscoveryService } from './discovery.service.js';
import { toRoute } from './route.presenter.js';
import type { RoutesService } from './routes.service.js';

export function createRoutesDiscoveryController(
  discovery: DiscoveryService,
  routes: RoutesService,
) {
  const startDiscovery: RequestHandler = (req, res) => {
    res.status(202).json({ discovery: discovery.start(parseId(req.params.id)) });
  };

  const getDiscovery: RequestHandler = (req, res) => {
    res.json({ discovery: discovery.get(parseId(req.params.id)) });
  };

  const listRoutes: RequestHandler = (req, res) => {
    const { status } = routeListQuerySchema.parse(req.query);
    res.json({ routes: routes.list(parseId(req.params.id), status).map(toRoute) });
  };

  const updateRoute: RequestHandler = (req, res) => {
    const route = routes.update(parseId(req.params.id), updateRouteSchema.parse(req.body));
    res.json({ route: toRoute(route) });
  };

  const createRoute: RequestHandler = (req, res) => {
    const route = routes.create(parseId(req.params.id), createRouteSchema.parse(req.body));
    res.status(201).json({ route: toRoute(route) });
  };

  const replaceRoute: RequestHandler = (req, res) => {
    const { replaced, route } = routes.replace(
      parseId(req.params.id),
      replaceRouteSchema.parse(req.body),
    );
    discovery.resolveReplacement(replaced.institutionId, replaced.id);
    res.json({ replaced: toRoute(replaced), route: toRoute(route) });
  };

  return { startDiscovery, getDiscovery, listRoutes, updateRoute, createRoute, replaceRoute };
}
