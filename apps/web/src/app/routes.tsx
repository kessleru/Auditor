import type { RouteObject } from 'react-router';
import { AuditorLayout } from './layouts/AuditorLayout';
import { PublicLayout } from './layouts/PublicLayout';
import { NotFoundPage } from './NotFoundPage';
import { PlaceholderPage } from './PlaceholderPage';
import { Root } from './Root';

const placeholder = (title: string, phase: number) => (
  <PlaceholderPage title={title} phase={phase} />
);

/** Catálogo de componentes: só em desenvolvimento (fica fora do build de produção). */
const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [
      {
        path: 'dev/ui',
        lazy: async () => ({
          Component: (await import('../features/dev/UiCatalogPage')).UiCatalogPage,
        }),
      },
    ]
  : [];

// Mapa de telas: seção 5.1 do plano.
export const routes: RouteObject[] = [
  {
    Component: Root,
    children: [
      {
        Component: PublicLayout,
        children: [
          { index: true, element: placeholder('Resultados', 6) },
          { path: 'instituicoes', element: placeholder('Instituições', 6) },
          { path: 'instituicoes/:id', element: placeholder('Instituição', 6) },
          { path: 'metodologia', element: placeholder('Sobre a metodologia', 6) },
          { path: 'entrar', element: placeholder('Entrar como auditor', 6) },
          ...devRoutes,
          { path: '*', Component: NotFoundPage },
        ],
      },
      {
        Component: AuditorLayout,
        children: [
          { path: 'painel', element: placeholder('Painel', 9) },
          { path: 'comparativo', element: placeholder('Comparativo', 9) },
          { path: 'gestao/instituicoes', element: placeholder('Instituições', 7) },
          { path: 'auditorias/nova', element: placeholder('Nova auditoria', 7) },
          {
            path: 'auditorias/:id/rotas/:institutionId',
            element: placeholder('Revisão de rotas', 7),
          },
          { path: 'coletas', element: placeholder('Coletas em andamento', 7) },
          { path: 'coletas/:id', element: placeholder('Coleta', 7) },
          { path: 'historico', element: placeholder('Histórico', 7) },
          { path: 'inspecao', element: placeholder('Portais em inspeção', 8) },
          { path: 'inspecao/:collectionId', element: placeholder('Portais em inspeção', 8) },
          {
            path: 'inspecao/:collectionId/:institutionId/:tab',
            element: placeholder('Inspeção do portal', 8),
          },
        ],
      },
    ],
  },
];
