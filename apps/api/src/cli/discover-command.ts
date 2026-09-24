import {
  type PageFunctionKey,
  pageFunctionKeys,
  pageFunctionLabels,
} from '@auditoria-rf/contracts';
import type { Services } from '../services.js';

export interface DiscoverArgs {
  /** Sigla (ex.: IFTM) ou id; sem ela, `all` precisa estar ligado. */
  institution?: string;
  /** Todas as instituições ativas, uma de cada vez. */
  all?: boolean;
  /** Quantas candidatas mostrar por função (padrão 3). */
  top?: string;
}

export class DiscoverCommandError extends Error {}

const byRelevance = (a: { relevance: number | null; url: string }, b: typeof a) =>
  (b.relevance ?? -1) - (a.relevance ?? -1) || a.url.length - b.url.length;

/**
 * Descoberta de rotas pela CLI, com os mesmos services da API (seção 1.3): grava as rotas como
 * sugestões (nada é confirmado) e imprime, por função, as candidatas mais relevantes. Serve para
 * testar a descoberta contra os portais reais antes de revisar as rotas na interface.
 */
export async function runDiscover(
  args: DiscoverArgs,
  services: Services,
  print: (line: string) => void,
): Promise<{ ok: number; failed: number }> {
  const top = args.top === undefined ? 3 : Number(args.top);
  if (!Number.isInteger(top) || top < 1) {
    throw new DiscoverCommandError('--top precisa ser um número inteiro maior que zero.');
  }
  const all = services.institutions.list();
  let targets;
  if (args.all) {
    targets = all.filter((i) => i.active);
  } else {
    const wanted = args.institution?.trim();
    if (!wanted) throw new DiscoverCommandError('Informe --institution <sigla|id> ou --all.');
    const found = all.find(
      (i) => String(i.id) === wanted || i.acronym.toUpperCase() === wanted.toUpperCase(),
    );
    if (!found) throw new DiscoverCommandError(`Instituição não encontrada: ${wanted}.`);
    targets = [found];
  }

  let ok = 0;
  let failed = 0;
  for (const institution of targets) {
    print(`\n== ${institution.acronym} (${institution.domain})`);
    services.discovery.start(institution.id);
    const state = await services.discovery.waitFor(institution.id);
    if (state.status !== 'completed' || !state.summary) {
      failed++;
      print(`Falhou: ${state.error ?? 'erro desconhecido'}`);
      continue;
    }
    ok++;
    const s = state.summary;
    print(
      `${s.found} URL(s) em ${s.origin} por ${s.source === 'sitemap' ? `sitemap (${s.sitemapFiles} arquivo(s)) e links da página inicial` : 'rastreamento'}` +
        ` · ${s.created} nova(s) · ${s.withSuggestion} com função sugerida · ${s.authenticated} autenticada(s)` +
        ` · ${s.blockedByRobots} bloqueada(s) pelo robots.txt · ${s.failed} falha(s)` +
        ` · robots.txt ${s.robotsTxtFound ? 'encontrado' : 'ausente'}`,
    );

    const routes = services.routes.list(institution.id);
    for (const key of pageFunctionKeys as readonly PageFunctionKey[]) {
      const confirmed = routes.find((r) => r.status === 'confirmed' && r.functionKey === key);
      const candidates = routes
        .filter((r) => r.status === 'suggested' && r.functionKey === key)
        .sort(byRelevance);
      const label = pageFunctionLabels[key];
      if (confirmed) print(`  ${label}: confirmada ${confirmed.url}`);
      if (candidates.length === 0) {
        if (!confirmed) print(`  ${label}: nenhuma candidata — informe a URL na revisão de rotas.`);
        continue;
      }
      print(`  ${label}: ${candidates.length} candidata(s)`);
      for (const r of candidates.slice(0, top)) {
        const text = r.title ?? (r.linkText ? `link: ${r.linkText}` : '');
        print(`    [${r.relevance ?? '—'}] ${r.url}${text ? ` — ${text}` : ''}`);
      }
    }
    for (const r of state.replacements) {
      print(
        `  Possível substituição: ${r.url} (${r.reason === 'moved' ? 'mudou' : 'não responde'}, HTTP ${r.httpStatus})` +
          (r.candidateUrl ? ` → ${r.candidateUrl}` : ''),
      );
    }
  }
  print(
    `\n${ok} descoberta(s) concluída(s), ${failed} com falha. Nada foi confirmado: revise as rotas na interface.`,
  );
  return { ok, failed };
}
