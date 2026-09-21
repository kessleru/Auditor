import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { vi } from 'vitest';
import { routes } from '../app/routes';

/** Simula a API: responde 401 em /auth/me (visitante) ou devolve o auditor informado. */
export function stubApi(auditor: { id: number; email: string; name: string } | null = null) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/auth/me')) {
      return auditor
        ? Response.json({ user: auditor })
        : Response.json(
            { error: { code: 'UNAUTHENTICATED', message: 'Faça login.' } },
            { status: 401 },
          );
    }
    if (url.endsWith('/auth/logout')) return new Response(null, { status: 204 });
    return Response.json(
      { error: { code: 'NOT_FOUND', message: 'não simulado' } },
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
