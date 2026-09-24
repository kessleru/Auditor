import type { PageFunctionKey, Route } from '@auditoria-rf/contracts';
import type { BadgeVariant } from '../../components/ui';

/** Mais relevante primeiro; sem relevância por último; empate: URL mais curta. */
export function byRelevance(a: Route, b: Route): number {
  return (
    (b.relevance ?? -1) - (a.relevance ?? -1) ||
    a.url.length - b.url.length ||
    a.url.localeCompare(b.url)
  );
}

/** Sugestões da descoberta para a função, da mais para a menos relevante. */
export const candidatesFor = (routes: Route[], functionKey: PageFunctionKey): Route[] =>
  routes.filter((r) => r.status === 'suggested' && r.functionKey === functionKey).sort(byRelevance);

/** Faixa de relevância em texto: a cor do selo nunca é a única informação. */
export function relevanceBadge(
  relevance: number | null,
): { label: string; variant: BadgeVariant } | null {
  if (relevance === null) return null;
  if (relevance >= 70) return { label: 'Alta', variant: 'good' };
  if (relevance >= 40) return { label: 'Média', variant: 'moderate' };
  return { label: 'Baixa', variant: 'neutral' };
}

const fold = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/** A rota casa com o filtro no endereço, no título ou no texto do link (sem acento). */
export function matchesQuery(route: Route, query: string): boolean {
  const q = fold(query.trim());
  if (q === '') return true;
  return [route.url, route.title ?? '', route.linkText ?? ''].some((v) => fold(v).includes(q));
}

/** Rótulo curto da página: título, ou o texto do link que levou a ela. */
export const routeCaption = (route: Route): string | null =>
  route.title ?? (route.linkText ? `link: ${route.linkText}` : null);
