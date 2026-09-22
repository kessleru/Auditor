import { type PageFunctionKey, pageFunctionKeys } from '@auditoria-rf/contracts';

/** Escopo da auditoria em montagem, guardado na URL (sobrevive a recarregar e pode ser compartilhado). */
export interface AuditScope {
  institutionIds: number[];
  functions: PageFunctionKey[];
}

export function parseScope(params: URLSearchParams): AuditScope {
  const institutionIds = (params.get('instituicoes') ?? '')
    .split(',')
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);
  const requested = (params.get('funcoes') ?? '').split(',');
  const functions = pageFunctionKeys.filter((key) => requested.includes(key));
  return { institutionIds: [...new Set(institutionIds)], functions };
}

export function scopeSearch(scope: AuditScope): string {
  const params = new URLSearchParams({
    instituicoes: scope.institutionIds.join(','),
    funcoes: scope.functions.join(','),
  });
  return `?${params.toString().replaceAll('%2C', ',')}`;
}

export const isScopeValid = (scope: AuditScope) =>
  scope.institutionIds.length > 0 && scope.functions.length > 0;
