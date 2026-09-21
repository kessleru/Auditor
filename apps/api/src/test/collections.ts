import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AxeResults, Result } from 'axe-core';
import { eq } from 'drizzle-orm';
import type { DB } from '../db/client.js';
import { institutions, pageFunctions, routes } from '../db/schema.js';
import type { AuditOutcome, PageAuditor } from '../infra/auditor/page-auditor.js';

/** Instituição com rotas já confirmadas, gravada direto no banco (sem validação de domínio). */
export function seedInstitutionWithRoutes(
  db: DB,
  {
    domain,
    acronym,
    urls,
  }: { domain: string; acronym: string; urls: { url: string; functionKey?: string }[] },
) {
  const institution = db
    .insert(institutions)
    .values({ name: `Instituto ${acronym}`, acronym, domain })
    .returning()
    .get();
  const functionIds = new Map(
    db
      .select()
      .from(pageFunctions)
      .all()
      .map((f) => [f.key, f.id]),
  );
  const created = urls.map(({ url, functionKey }) =>
    db
      .insert(routes)
      .values({
        institutionId: institution.id,
        url,
        normalizedUrl: url,
        source: 'manual',
        status: 'confirmed',
        functionId: functionKey ? (functionIds.get(functionKey) ?? null) : null,
        confirmedAt: new Date(),
      })
      .returning()
      .get(),
  );
  return { institution, routes: created };
}

export function setRouteStatus(db: DB, routeId: number, status: 'suggested' | 'confirmed') {
  db.update(routes).set({ status }).where(eq(routes.id, routeId)).run();
}

const rule = (id: string, tags: string[], nodes: { target: string; html?: string }[] = []) =>
  ({
    id,
    impact: 'serious',
    tags,
    description: '',
    help: `ajuda ${id}`,
    helpUrl: `https://dequeuniversity.com/rules/axe/4.13/${id}`,
    nodes: nodes.map((n) => ({
      target: [n.target],
      html: n.html ?? `<x class="${n.target}">`,
      impact: 'serious',
    })),
  }) as unknown as Result;

/** Resultado do axe com as regras dadas violadas (e mais duas regras que passam). */
export function fakeResults(
  violations: { rule: string; tags?: string[]; targets: string[] }[] = [],
) {
  return {
    passes: [rule('document-title', ['wcag242']), rule('html-has-lang', ['wcag311'])],
    violations: violations.map((v) =>
      rule(
        v.rule,
        v.tags ?? ['wcag111'],
        v.targets.map((target) => ({ target })),
      ),
    ),
    incomplete: [rule('color-contrast', ['wcag143'])],
    inapplicable: [rule('video-caption', ['wcag122'])],
    testEngine: { name: 'axe-core', version: '4.13.0' },
  } as unknown as AxeResults;
}

export const okOutcome = (violations: Parameters<typeof fakeResults>[0] = []): AuditOutcome => ({
  ok: true,
  httpStatus: 200,
  finalUrl: 'http://local/',
  html: '<html><body>snapshot</body></html>',
  results: fakeResults(violations),
});

export function fakeAuditor(
  audit: (url: string) => Promise<AuditOutcome>,
): PageAuditor & { audited: string[] } {
  const audited: string[] = [];
  return {
    audited,
    versions: async () => ({
      axeVersion: '4.13.0',
      browserVersion: 'Chromium teste',
      userAgent: 'AuditoriaRF/1.0 (+teste)',
    }),
    audit: (url) => {
      audited.push(url);
      return audit(url);
    },
    close: async () => {},
  };
}

/** Promessa controlável: o teste decide quando a auditoria de uma página termina. */
export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

export function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'auditoria-'));
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}
