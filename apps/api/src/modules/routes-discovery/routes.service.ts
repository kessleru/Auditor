import type {
  createRouteSchema,
  FunctionAbsence,
  markFunctionAbsentSchema,
  PageFunctionKey,
  RouteStatus,
  replaceRouteSchema,
  updateRouteSchema,
} from '@auditoria-rf/contracts';
import type { z } from 'zod';
import { DEV_HOST_REASON, isDevHost, normalizeUrl } from '../../infra/crawler/url.js';
import { AppError, NotFoundError } from '../../shared/errors.js';
import type { InstitutionsService } from '../institutions/institutions.service.js';
import type { RoutesRepository, RouteWithFunction } from './routes.repository.js';

type UpdateRoute = z.output<typeof updateRouteSchema>;
type CreateRoute = z.output<typeof createRouteSchema>;
type ReplaceRoute = z.output<typeof replaceRouteSchema>;
type MarkAbsent = z.output<typeof markFunctionAbsentSchema>;

export function createRoutesService(
  repo: RoutesRepository,
  institutions: InstitutionsService,
  { now = () => new Date() }: { now?: () => Date } = {},
) {
  const getRoute = (id: number): RouteWithFunction => {
    const route = repo.findById(id);
    if (!route) throw new NotFoundError('Rota não encontrada.');
    return route;
  };

  const functionId = (key: PageFunctionKey) => {
    const id = repo.functionIdsByKey().get(key);
    if (id === undefined)
      throw new AppError(422, 'UNKNOWN_FUNCTION', `Função desconhecida: ${key}.`);
    return id;
  };

  /**
   * Uma rota confirmada por função em cada instituição: o comparativo é por função. Com
   * `replace`, a confirmada anterior volta a ser sugestão; sem ele, a operação é recusada.
   */
  const releaseFunction = (
    institutionId: number,
    fnId: number,
    exceptRouteId: number | null,
    replace: boolean,
  ) => {
    const current = repo
      .listByInstitution(institutionId, 'confirmed')
      .find((r) => r.functionId === fnId && r.id !== exceptRouteId);
    if (!current) return;
    if (!replace) {
      throw new AppError(
        409,
        'FUNCTION_ALREADY_CONFIRMED',
        `Esta função já tem uma rota confirmada (${current.url}). Troque a rota para substituí-la.`,
        { routeId: current.id },
      );
    }
    repo.update(current.id, { status: 'suggested', confirmedAt: null });
  };

  return {
    /** Funções marcadas como não encontradas na instituição (ADR 0013). */
    absences(institutionId: number): FunctionAbsence[] {
      institutions.get(institutionId);
      return repo
        .listAbsences(institutionId)
        .map((a) => ({ ...a, decidedAt: a.decidedAt.toISOString() }));
    },

    /**
     * O auditor procurou e a instituição não tem a página da função. Recusado se a função já
     * tem rota confirmada: é uma decisão ou outra.
     */
    markAbsent(
      institutionId: number,
      key: PageFunctionKey,
      { reason }: MarkAbsent,
      decidedBy: number,
    ): FunctionAbsence {
      institutions.get(institutionId);
      const fnId = functionId(key);
      const confirmed = repo
        .listByInstitution(institutionId, 'confirmed')
        .find((r) => r.functionId === fnId);
      if (confirmed) {
        throw new AppError(
          409,
          'FUNCTION_ALREADY_CONFIRMED',
          `Esta função tem rota confirmada (${confirmed.url}). Troque ou exclua a rota antes.`,
          { routeId: confirmed.id },
        );
      }
      const decidedAt = now();
      repo.upsertAbsence({ institutionId, functionId: fnId, reason, decidedBy, decidedAt });
      return { institutionId, functionKey: key, reason, decidedAt: decidedAt.toISOString() };
    },

    clearAbsence(institutionId: number, key: PageFunctionKey) {
      institutions.get(institutionId);
      repo.deleteAbsence(institutionId, functionId(key));
    },

    list(institutionId: number, status?: RouteStatus): RouteWithFunction[] {
      institutions.get(institutionId);
      return repo.listByInstitution(institutionId, status);
    },

    /** Decisão do auditor sobre a rota: confirmar, excluir (com motivo) ou atribuir função. */
    update(id: number, input: UpdateRoute): RouteWithFunction {
      const route = getRoute(id);

      return repo.transaction(() => {
        const changes: Parameters<RoutesRepository['update']>[1] = {};

        if (input.functionKey !== undefined) {
          changes.functionId = input.functionKey === null ? null : functionId(input.functionKey);
        }

        const finalStatus = input.status ?? route.status;
        const finalFunctionId =
          changes.functionId !== undefined ? changes.functionId : route.functionId;
        if (finalStatus === 'confirmed' && finalFunctionId !== null) {
          // Rota confirmada desfaz a marcação de "não encontrada" da função.
          repo.deleteAbsence(route.institutionId, finalFunctionId);
          releaseFunction(
            route.institutionId,
            finalFunctionId,
            route.id,
            input.replaceConfirmed ?? false,
          );
        }

        if (input.status !== undefined && input.status !== route.status) {
          changes.status = input.status;
          changes.confirmedAt = input.status === 'confirmed' ? now() : null;
          if (input.status !== 'excluded') changes.exclusionReason = null;
        }
        if (input.status === 'excluded') changes.exclusionReason = input.exclusionReason ?? null;

        repo.update(id, changes);
        return getRoute(id);
      });
    },

    /** Rota informada pelo auditor: mesma origem do portal, já confirmada para a função. */
    create(institutionId: number, input: CreateRoute): RouteWithFunction {
      const institution = institutions.get(institutionId);
      const url = normalizeUrl(input.url);
      if (!url) throw new AppError(400, 'INVALID_URL', 'URL inválida.');
      const host = new URL(url).host;
      if (host !== institution.domain && !host.endsWith(`.${institution.domain}`)) {
        throw new AppError(
          422,
          'OUTSIDE_DOMAIN',
          `A URL precisa ser do domínio ${institution.domain}.`,
        );
      }
      if (isDevHost(host)) throw new AppError(422, 'DEV_HOST', DEV_HOST_REASON);

      return repo.transaction(() => {
        const fnId = functionId(input.functionKey);
        repo.deleteAbsence(institutionId, fnId);
        const existing = repo.findByNormalizedUrl(institutionId, url);
        releaseFunction(institutionId, fnId, existing?.id ?? null, input.replaceConfirmed ?? false);
        const confirmedAt = now();
        if (existing) {
          repo.update(existing.id, {
            status: 'confirmed',
            functionId: fnId,
            confirmedAt,
            exclusionReason: null,
          });
          return getRoute(existing.id);
        }
        const created = repo.insert({
          institutionId,
          url,
          normalizedUrl: url,
          functionId: fnId,
          source: 'manual',
          status: 'confirmed',
          discoveredAt: confirmedAt,
          confirmedAt,
        });
        return getRoute(created.id);
      });
    },

    /**
     * Substituição confirmada pelo auditor (seção 3.1.7): a nova rota herda a função e fica
     * confirmada; a antiga fica excluída, apontando para a nova, e o histórico da função continua.
     */
    replace(id: number, { newRouteId }: ReplaceRoute) {
      const old = getRoute(id);
      const next = getRoute(newRouteId);
      if (old.status !== 'confirmed') {
        throw new AppError(
          409,
          'ROUTE_NOT_CONFIRMED',
          'Só uma rota confirmada pode ser substituída.',
        );
      }
      if (next.institutionId !== old.institutionId || next.id === old.id) {
        throw new AppError(
          422,
          'INVALID_REPLACEMENT',
          'A nova rota precisa ser outra rota da mesma instituição.',
        );
      }
      // A nova rota herda a função: se já é a confirmada de outra função, essa perderia a rota.
      if (next.status === 'confirmed' && next.functionId !== old.functionId) {
        throw new AppError(
          409,
          'FUNCTION_ALREADY_CONFIRMED',
          `A rota ${next.url} já está confirmada para outra função.`,
          { routeId: next.id },
        );
      }

      return repo.transaction(() => {
        const at = now();
        repo.update(old.id, {
          status: 'excluded',
          exclusionReason: `Substituída por ${next.url}`,
          replacedByRouteId: next.id,
          confirmedAt: null,
        });
        repo.update(next.id, {
          status: 'confirmed',
          functionId: old.functionId,
          confirmedAt: at,
          exclusionReason: null,
        });
        return { replaced: getRoute(old.id), route: getRoute(next.id) };
      });
    },
  };
}

export type RoutesService = ReturnType<typeof createRoutesService>;
