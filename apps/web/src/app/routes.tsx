import type { RouteObject } from 'react-router';
import { AuditorLayout } from './layouts/AuditorLayout';
import { PublicLayout } from './layouts/PublicLayout';
import { NotFoundPage } from './NotFoundPage';
import { PlaceholderPage } from './PlaceholderPage';
import { Root } from './Root';
import { LoginPage } from '../features/auth/LoginPage';
import { NewAuditPage } from '../features/audits/NewAuditPage';
import { RouteReviewOverviewPage } from '../features/audits/RouteReviewOverviewPage';
import { RouteReviewPage } from '../features/audits/RouteReviewPage';
import { CollectionPage } from '../features/collections/CollectionPage';
import { CollectionsListPage } from '../features/collections/CollectionsListPage';
import { DashboardPage } from '../features/collections/DashboardPage';
import { InstitutionsAdminPage } from '../features/institutions/InstitutionsAdminPage';
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
          { path: 'painel', Component: DashboardPage },
          { path: 'comparativo', element: placeholder('Comparativo', 9) },
          { path: 'gestao/instituicoes', Component: InstitutionsAdminPage },
          { path: 'auditorias/nova', Component: NewAuditPage },
          { path: 'auditorias/nova/rotas', Component: RouteReviewOverviewPage },
          { path: 'auditorias/:id/rotas/:institutionId', Component: RouteReviewPage },
          {
            path: 'coletas',
            element: (
              <CollectionsListPage
                title="Coletas em andamento"
                statuses={['queued', 'running']}
                emptyText="Nenhuma coleta em andamento"
              />
            ),
          },
          { path: 'coletas/:id', Component: CollectionPage },
          {
            path: 'historico',
            element: (
              <CollectionsListPage
                title="Histórico de coletas"
                statuses={['completed', 'partial', 'cancelled']}
                emptyText="Nenhuma coleta terminada"
              />
            ),
          },
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
