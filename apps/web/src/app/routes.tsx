import { Navigate, type RouteObject, useParams } from 'react-router';
import { AuditorLayout } from './layouts/AuditorLayout';
import { PublicLayout } from './layouts/PublicLayout';
import { NotFoundPage } from './NotFoundPage';
import { Root } from './Root';
import { LoginPage } from '../features/auth/LoginPage';
import { AuditScopePage, NewAuditPage } from '../features/audits/NewAuditPage';
import { RouteReviewOverviewPage } from '../features/audits/RouteReviewOverviewPage';
import { RouteReviewPage } from '../features/audits/RouteReviewPage';
import { CollectionPage } from '../features/collections/CollectionPage';
import { CollectionsListPage } from '../features/collections/CollectionsListPage';
import { DashboardPage } from '../features/collections/DashboardPage';
import { InstitutionsAdminPage } from '../features/institutions/InstitutionsAdminPage';
import { AssistiveTab } from '../features/inspection/AssistiveTab';
import { InspectionCollectionPage } from '../features/inspection/InspectionCollectionPage';
import { InspectionHomePage } from '../features/inspection/InspectionHomePage';
import { PortalLayout } from '../features/inspection/PortalLayout';
import { TasksTab } from '../features/inspection/TasksTab';
import { ValidationTab } from '../features/inspection/ValidationTab';
import { AuditorInstitutionPage } from '../features/results/AuditorInstitutionPage';
import { ComparisonPage } from '../features/results/ComparisonPage';
import { IndicatorsPage } from '../features/results/IndicatorsPage';
import { InstitutionDetailPage } from '../features/results/InstitutionDetailPage';
import { MethodologyPage } from '../features/results/MethodologyPage';
import { PublicHomePage } from '../features/results/PublicHomePage';
import { PublicInstitutionsPage } from '../features/results/PublicInstitutionsPage';

/** Aba da inspeção pelo segmento da URL (validacao | tarefas | verificacao). */
function TabSwitch() {
  const { tab } = useParams();
  if (tab === 'tarefas') return <TasksTab />;
  if (tab === 'verificacao') return <AssistiveTab />;
  if (tab === 'validacao') return <ValidationTab />;
  return <Navigate to="../validacao" replace />;
}

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
          { path: 'comparativo', Component: ComparisonPage },
          { path: 'indicadores', Component: IndicatorsPage },
          { path: 'painel/instituicoes/:id', Component: AuditorInstitutionPage },
          { path: 'gestao/instituicoes', Component: InstitutionsAdminPage },
          { path: 'auditorias/nova', Component: NewAuditPage },
          { path: 'auditorias/nova/escopo', Component: AuditScopePage },
          { path: 'auditorias/nova/rotas', Component: RouteReviewOverviewPage },
          { path: 'auditorias/:id/rotas/:institutionId', Component: RouteReviewPage },
          {
            path: 'coletas',
            element: (
              <CollectionsListPage
                title="Coletas em andamento"
                description="Coletas na fila ou executando agora."
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
                description="Coletas terminadas, com o resultado de cada uma."
                statuses={['completed', 'partial', 'cancelled']}
                emptyText="Nenhuma coleta terminada"
              />
            ),
          },
          { path: 'inspecao', Component: InspectionHomePage },
          { path: 'inspecao/:collectionId', Component: InspectionCollectionPage },
          {
            path: 'inspecao/:collectionId/:institutionId',
            Component: PortalLayout,
            children: [
              { index: true, element: <Navigate to="validacao" replace /> },
              { path: ':tab', Component: TabSwitch },
            ],
          },
        ],
      },
    ],
  },
];
