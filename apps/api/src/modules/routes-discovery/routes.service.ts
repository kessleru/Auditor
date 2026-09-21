import type { RouteStatus, updateRouteSchema } from '@auditoria-rf/contracts';
import type { z } from 'zod';
import { NotFoundError } from '../../shared/errors.js';
import type { InstitutionsService } from '../institutions/institutions.service.js';
import type { RoutesRepository, RouteWithFunction } from './routes.repository.js';

type UpdateRoute = z.output<typeof updateRouteSchema>;

export function createRoutesService(
  repo: RoutesRepository,
  institutions: InstitutionsService,
  { now = () => new Date() }: { now?: () => Date } = {},
) {
  return {
    list(institutionId: number, status?: RouteStatus): RouteWithFunction[] {
      institutions.get(institutionId);
      return repo.listByInstitution(institutionId, status);
    },

    /** Decisão do auditor sobre a rota: confirmar, excluir (com motivo) ou atribuir função. */
    update(id: number, input: UpdateRoute): RouteWithFunction {
      const route = repo.findById(id);
      if (!route) throw new NotFoundError('Rota não encontrada.');

      const changes: Parameters<RoutesRepository['update']>[1] = {};

      if (input.functionKey !== undefined) {
        changes.functionId =
          input.functionKey === null
            ? null
            : (repo.functionIdsByKey().get(input.functionKey) ?? null);
      }

      if (input.status !== undefined && input.status !== route.status) {
        changes.status = input.status;
        changes.confirmedAt = input.status === 'confirmed' ? now() : null;
        if (input.status !== 'excluded') changes.exclusionReason = null;
      }
      if (input.status === 'excluded') changes.exclusionReason = input.exclusionReason ?? null;

      repo.update(id, changes);
      return repo.findById(id) as RouteWithFunction;
    },
  };
}

export type RoutesService = ReturnType<typeof createRoutesService>;
