import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { vi } from 'vitest';
import { routes } from '../app/routes';

type Handler = (init: RequestInit | undefined) => Response | Promise<Response>;

export interface StubOptions {
  /** Respostas por "MÉTODO /caminho" (sem o prefixo /api/v1). Valor = corpo JSON ou função. */
  routes?: Record<string, unknown | Handler>;
}

/**
 * Simula a API. `auditor = null` → visitante (401 em /auth/me). Rotas não simuladas respondem 404.
 */
export function stubApi(
  auditor: { id: number; email: string; name: string } | null = null,
  { routes: handlers = {} }: StubOptions = {},
) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input), 'http://localhost').pathname.replace(/^\/api\/v1/, '');
    const key = `${init?.method ?? 'GET'} ${path}`;
    const handler = handlers[key];
    if (handler !== undefined) {
      return typeof handler === 'function' ? (handler as Handler)(init) : Response.json(handler);
    }
    if (key === 'GET /auth/me') {
      return auditor
        ? Response.json({ user: auditor })
        : Response.json(
            { error: { code: 'UNAUTHENTICATED', message: 'Faça login.' } },
            { status: 401 },
          );
    }
    if (key === 'POST /auth/logout') return new Response(null, { status: 204 });
    return Response.json(
      { error: { code: 'NOT_FOUND', message: `não simulado: ${key}` } },
      { status: 404 },
    );
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

export function renderWithQuery(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

/** Renderiza o app inteiro numa rota, com as rotas reais. */
export function renderRoute(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const view = renderWithQuery(<RouterProvider router={router} />);
  return { router, ...view };
}
