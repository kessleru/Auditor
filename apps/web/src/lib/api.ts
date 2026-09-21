import { apiErrorSchema } from '@auditoria-rf/contracts';
import type { z } from 'zod';

export const API_BASE = '/api/v1';

/** Erro no formato padrão da API: `{ error: { code, message, details? } }`. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface RequestOptions<T> {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Schema de `contracts` que valida a resposta. */
  schema?: z.ZodType<T>;
  signal?: AbortSignal;
}

export async function apiRequest<T = void>(
  path: string,
  options: RequestOptions<T> = {},
): Promise<T> {
  const { method = 'GET', body, schema, signal } = options;
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      credentials: 'include',
      headers:
        body === undefined
          ? { accept: 'application/json' }
          : { 'content-type': 'application/json', accept: 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'Não foi possível falar com o servidor. Verifique a conexão.',
    );
  }

  if (!res.ok) {
    const parsed = apiErrorSchema.safeParse(await res.json().catch(() => null));
    if (parsed.success) {
      const { code, message, details } = parsed.data.error;
      throw new ApiError(res.status, code, message, details);
    }
    throw new ApiError(res.status, 'HTTP_ERROR', `O servidor respondeu com erro (${res.status}).`);
  }

  if (res.status === 204 || !schema) return undefined as T;
  return schema.parse(await res.json());
}
