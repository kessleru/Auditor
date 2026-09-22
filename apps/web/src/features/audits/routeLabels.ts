import type { Route, RouteSource } from '@auditoria-rf/contracts';
import type { BadgeVariant } from '../../components/ui';

export const sourceLabels: Record<RouteSource, string> = {
  sitemap: 'sitemap',
  crawler: 'rastreamento',
  manual: 'manual',
};

export const statusBadges: Record<Route['status'], { label: string; variant: BadgeVariant }> = {
  confirmed: { label: 'Confirmada', variant: 'good' },
  suggested: { label: 'Revisar sugestão', variant: 'moderate' },
  authenticated: { label: 'Fora do escopo', variant: 'neutral' },
  excluded: { label: 'Excluída', variant: 'neutral' },
};

/** URL sem o protocolo, para leitura mais curta na tabela. */
export const displayUrl = (url: string) => url.replace(/^https?:\/\//, '');
