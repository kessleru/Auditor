import { EmptyState, PageTitle } from '../components/ui';

/** Tela ainda não construída; cada fase seguinte do plano substitui a sua. */
export function PlaceholderPage({ title, phase }: { title: string; phase: number }) {
  return (
    <div className="flex flex-col gap-6">
      <PageTitle>{title}</PageTitle>
      <EmptyState
        title="Em construção"
        description={`Esta tela chega na Fase ${phase} do plano de implementação.`}
      />
    </div>
  );
}
