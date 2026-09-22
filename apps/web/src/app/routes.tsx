import type { RouteObject } from 'react-router';
import { AuditorLayout } from './layouts/AuditorLayout';
import { PublicLayout } from './layouts/PublicLayout';
import { NotFoundPage } from './NotFoundPage';
import { PlaceholderPage } from './PlaceholderPage';
import { Root } from './Root';
import { LoginPage } from '../features/auth/LoginPage';
import { InstitutionDetailPage } from '../features/results/InstitutionDetailPage';
import { MethodologyPage } from '../features/results/MethodologyPage';
import { PublicHomePage } from '../features/results/PublicHomePage';
import { PublicInstitutionsPage } from '../features/results/PublicInstitutionsPage';

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
      // Tela 0.1 tem layout próprio (painel de marca + formulário).
      { path: 'entrar', Component: LoginPage },
      {
        Component: PublicLayout,
        children: [
          { index: true, Component: PublicHomePage },
          { path: 'instituicoes', Component: PublicInstitutionsPage },
          { path: 'instituicoes/:id', Component: InstitutionDetailPage },
          { path: 'metodologia', Component: MethodologyPage },
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
