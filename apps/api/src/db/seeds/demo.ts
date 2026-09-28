import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';
import type { PageFunctionKey } from '@auditoria-rf/contracts';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { fingerprintOf } from '../../infra/auditor/axe-mapping.js';
import { DEMO_AUDITOR } from '../../shared/demo.js';
import type { DB } from '../client.js';
import {
  collectionPages,
  collections,
  findings,
  functionAbsences,
  inspectionSample,
  institutions,
  pageFunctions,
  routes,
  users,
} from '../schema.js';

// Dados de demonstração (ADR 0015): coletas reais, feitas com as ferramentas do sistema, empacotadas
// em `apps/api/demo/` e importadas pelo seed a cada subida, para a apresentação.

/** Pasta do pacote: `apps/api/demo`, tanto rodando de `src/` quanto de `dist/`. */
export const DEMO_DATASET_DIR = fileURLToPath(new URL('../../../demo', import.meta.url));
const DATA_FILE = 'dados.json.gz';
const FILES_DIR = 'arquivos';

/** Hash argon2id de um segredo aleatório já descartado: ninguém entra com esta conta. */
const DEMO_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,p=4,t=3$TzSmf5YGElsUKAMHNc6InQ$NecLlmB9w/sTDTck4BBghNpj+ZgYQ7/fesl3ZgNz6io';

type Row<T extends { $inferSelect: unknown }> = T['$inferSelect'];
/** Datas viram texto ISO no JSON; os IDs de origem só servem para ligar as linhas. */
type Plain<T> = {
  [K in keyof T]: T[K] extends Date ? string : T[K] extends Date | null ? string | null : T[K];
};

interface DemoDataset {
  version: 1;
  exportedAt: string;
  institutions: { acronym: string; name: string; domain: string }[];
  routes: (Omit<Plain<Row<typeof routes>>, 'institutionId' | 'functionId' | 'replacedByRouteId'> & {
    institution: string;
    functionKey: PageFunctionKey | null;
  })[];
  absences: {
    institution: string;
    functionKey: PageFunctionKey;
    reason: string;
    decidedAt: string;
  }[];
  collections: (Omit<Plain<Row<typeof collections>>, 'createdBy' | 'scopeJson'> & {
    scope: { institutions: string[]; functions?: PageFunctionKey[] };
    sample: { institution: string; selectedAt: string }[];
  })[];
  pages: (Omit<Plain<Row<typeof collectionPages>>, 'functionId'> & {
    functionKey: PageFunctionKey | null;
  })[];
  findings: Omit<Plain<Row<typeof findings>>, 'validatedBy' | 'fingerprint'>[];
}

const iso = (date: Date | null) => (date ? date.toISOString() : null);
const toDate = (value: string | null) => (value ? new Date(value) : null);
const resultsPathOf = (snapshotPath: string) => snapshotPath.replace(/\.html\.gz$/, '.axe.json.gz');

/** Conta que assina a demonstração; criada uma vez, com senha inutilizável. */
export function ensureDemoAuditor(db: DB): { id: number } {
  const existing = db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, DEMO_AUDITOR.email))
    .get();
  if (existing) return existing;
  return db
    .insert(users)
    .values({ ...DEMO_AUDITOR, passwordHash: DEMO_PASSWORD_HASH })
    .returning({ id: users.id })
    .get();
}

/**
 * Grava as coletas em `outDir`: `dados.json.gz` e, em `arquivos/`, snapshot e resultado do axe de
 * cada página e só as fotos dos exemplos exibidos nas telas (o primeiro achado de cada problema),
 * para o repositório não inchar.
 */
export async function exportDemo(
  db: DB,
  {
    collectionIds,
    snapshotsDir,
    outDir,
  }: { collectionIds: number[]; snapshotsDir: string; outDir: string },
) {
  const keyOf = new Map(
    db
      .select()
      .from(pageFunctions)
      .all()
      .map((f) => [f.id, f.key as PageFunctionKey]),
  );
  const cols = db
    .select()
    .from(collections)
    .where(inArray(collections.id, collectionIds))
    .orderBy(asc(collections.id))
    .all();
  const institutionIds = [
    ...new Set(cols.flatMap((c) => (c.scopeJson as { institutionIds: number[] }).institutionIds)),
  ];
  const insts = db
    .select()
    .from(institutions)
    .where(inArray(institutions.id, institutionIds))
    .all();
  const acronymOf = new Map(insts.map((i) => [i.id, i.acronym]));
  const acronym = (id: number) => acronymOf.get(id) as string;

  const pages = db
    .select()
    .from(collectionPages)
    .where(inArray(collectionPages.collectionId, collectionIds))
    .orderBy(asc(collectionPages.id))
    .all();
  const pageRoutes = db
    .select()
    .from(routes)
    .where(
      inArray(
        routes.id,
        pages.map((p) => p.routeId),
      ),
    )
    .orderBy(asc(routes.id))
    .all();
  const absences = db
    .select()
    .from(functionAbsences)
    .where(inArray(functionAbsences.institutionId, institutionIds))
    .all();
  const samples = db
    .select()
    .from(inspectionSample)
    .where(inArray(inspectionSample.collectionId, collectionIds))
    .all();
  const rows = db
    .select()
    .from(findings)
    .where(
      inArray(
        findings.collectionPageId,
        pages.map((p) => p.id),
      ),
    )
    .orderBy(asc(findings.id))
    .all();

  rmSync(join(outDir, FILES_DIR), { recursive: true, force: true });
  const copy = (relativePath: string) => {
    const target = join(outDir, FILES_DIR, relativePath);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(snapshotsDir, relativePath), target);
  };

  for (const page of pages) {
    if (!page.snapshotPath) continue;
    copy(page.snapshotPath);
    copy(resultsPathOf(page.snapshotPath));
  }
  const collectionOfPage = new Map(pages.map((p) => [p.id, p.collectionId]));
  const withExample = new Set<string>();
  let screenshots = 0;
  const exportedFindings = rows.map(({ validatedBy: _by, fingerprint, ...finding }) => {
    const group = `${collectionOfPage.get(finding.collectionPageId)} ${fingerprint}`;
    const isExample = !withExample.has(group);
    withExample.add(group);
    const screenshotPath = isExample ? finding.screenshotPath : null;
    if (screenshotPath) {
      copy(screenshotPath);
      screenshots++;
    }
    return { ...finding, screenshotPath, validatedAt: iso(finding.validatedAt) };
  });

  const dataset: DemoDataset = {
    version: 1,
    exportedAt: new Date().toISOString(),
    institutions: insts.map(({ acronym, name, domain }) => ({ acronym, name, domain })),
    routes: pageRoutes.map(({ institutionId, functionId, replacedByRouteId: _r, ...route }) => ({
      ...route,
      institution: acronym(institutionId),
      functionKey: functionId === null ? null : (keyOf.get(functionId) ?? null),
      discoveredAt: route.discoveredAt.toISOString(),
      confirmedAt: iso(route.confirmedAt),
      lastSeenAt: iso(route.lastSeenAt),
    })),
    absences: absences.map((a) => ({
      institution: acronym(a.institutionId),
      functionKey: keyOf.get(a.functionId) as PageFunctionKey,
      reason: a.reason,
      decidedAt: a.decidedAt.toISOString(),
    })),
    collections: cols.map(({ createdBy: _c, scopeJson, ...collection }) => {
      const scope = scopeJson as { institutionIds: number[]; functions?: PageFunctionKey[] };
      return {
        ...collection,
        createdAt: collection.createdAt.toISOString(),
        startedAt: iso(collection.startedAt),
        finishedAt: iso(collection.finishedAt),
        scope: {
          institutions: scope.institutionIds.map(acronym),
          ...(scope.functions && { functions: scope.functions }),
        },
        sample: samples
          .filter((s) => s.collectionId === collection.id)
          .map((s) => ({
            institution: acronym(s.institutionId),
            selectedAt: s.selectedAt.toISOString(),
          })),
      };
    }),
    pages: pages.map(({ functionId, ...page }) => ({
      ...page,
      functionKey: functionId === null ? null : (keyOf.get(functionId) ?? null),
      evaluatedAt: iso(page.evaluatedAt),
    })),
    findings: exportedFindings,
  };
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, DATA_FILE), gzipSync(JSON.stringify(dataset)));
  return {
    collections: cols.length,
    pages: pages.length,
    findings: rows.length,
    screenshots,
  };
}

/**
 * Importa a demonstração se ela ainda não estiver no banco (idempotente: a conta de demonstração
 * já com coletas = já importada). IDs novos, instituições casadas pela sigla, fingerprints
 * recalculados (dependem do id da instituição) e arquivos copiados para os caminhos novos.
 * Decisões do auditor nunca mudam: rota que já existe fica como está, e a rota confirmada ou a
 * função não encontrada da demonstração só entra se a função ainda não tiver decisão.
 */
export async function importDemo(
  db: DB,
  { datasetDir = DEMO_DATASET_DIR, snapshotsDir }: { datasetDir?: string; snapshotsDir: string },
): Promise<{ imported: boolean; collections: number }> {
  const file = join(datasetDir, DATA_FILE);
  const none = { imported: false, collections: 0 };
  if (!existsSync(file)) return none;
  const data = JSON.parse(gunzipSync(readFileSync(file)).toString('utf8')) as DemoDataset;
  if (data.version !== 1) return none;

  return db.transaction(() => {
    const demo = ensureDemoAuditor(db);
    const already = db
      .select({ id: collections.id })
      .from(collections)
      .where(eq(collections.createdBy, demo.id))
      .get();
    if (already) return none;

    const functionIdOf = new Map(
      db
        .select()
        .from(pageFunctions)
        .all()
        .map((f) => [f.key, f.id]),
    );
    const fnId = (key: PageFunctionKey | null) =>
      key === null ? null : (functionIdOf.get(key) ?? null);

    const institutionIdOf = new Map<string, number>();
    for (const inst of data.institutions) {
      const found =
        db.select().from(institutions).where(eq(institutions.acronym, inst.acronym)).get() ??
        db.select().from(institutions).where(eq(institutions.domain, inst.domain)).get() ??
        db.insert(institutions).values(inst).returning().get();
      institutionIdOf.set(inst.acronym, found.id);
    }
    const instId = (acronym: string) => institutionIdOf.get(acronym) as number;

    /** A função já tem decisão do auditor (rota confirmada ou marcada como não encontrada)? */
    const decided = (institutionId: number, functionId: number) =>
      db
        .select({ id: routes.id })
        .from(routes)
        .where(
          and(
            eq(routes.institutionId, institutionId),
            eq(routes.functionId, functionId),
            eq(routes.status, 'confirmed'),
          ),
        )
        .get() ??
      db
        .select({ id: functionAbsences.id })
        .from(functionAbsences)
        .where(
          and(
            eq(functionAbsences.institutionId, institutionId),
            eq(functionAbsences.functionId, functionId),
          ),
        )
        .get();

    const routeIdOf = new Map<number, number>();
    for (const { id, institution, functionKey, ...route } of data.routes) {
      const institutionId = instId(institution);
      const existing = db
        .select({ id: routes.id })
        .from(routes)
        .where(
          and(
            eq(routes.institutionId, institutionId),
            eq(routes.normalizedUrl, route.normalizedUrl),
          ),
        )
        .get();
      if (existing) {
        routeIdOf.set(id, existing.id);
        continue;
      }
      const functionId = fnId(functionKey);
      const confirmed =
        route.status === 'confirmed' &&
        (functionId === null || !decided(institutionId, functionId));
      const status = route.status === 'confirmed' && !confirmed ? 'suggested' : route.status;
      const inserted = db
        .insert(routes)
        .values({
          ...route,
          institutionId,
          functionId,
          status,
          discoveredAt: new Date(route.discoveredAt),
          confirmedAt: confirmed ? toDate(route.confirmedAt) : null,
          lastSeenAt: toDate(route.lastSeenAt),
        })
        .returning({ id: routes.id })
        .get();
      routeIdOf.set(id, inserted.id);
    }

    for (const absence of data.absences) {
      const institutionId = instId(absence.institution);
      const functionId = fnId(absence.functionKey);
      if (functionId === null || decided(institutionId, functionId)) continue;
      db.insert(functionAbsences)
        .values({
          institutionId,
          functionId,
          reason: absence.reason,
          decidedBy: demo.id,
          decidedAt: new Date(absence.decidedAt),
        })
        .run();
    }

    const institutionOfRoute = new Map(
      data.routes.map((r) => [r.id, instId(r.institution)] as const),
    );
    const collectionIdOf = new Map<number, number>();
    for (const { id, scope, sample, ...collection } of data.collections) {
      const inserted = db
        .insert(collections)
        .values({
          ...collection,
          scopeJson: {
            institutionIds: scope.institutions.map(instId),
            ...(scope.functions && { functions: scope.functions }),
          },
          createdBy: demo.id,
          createdAt: new Date(collection.createdAt),
          startedAt: toDate(collection.startedAt),
          finishedAt: toDate(collection.finishedAt),
        })
        .returning({ id: collections.id })
        .get();
      collectionIdOf.set(id, inserted.id);
      for (const s of sample) {
        db.insert(inspectionSample)
          .values({
            collectionId: inserted.id,
            institutionId: instId(s.institution),
            selectedBy: demo.id,
            selectedAt: new Date(s.selectedAt),
          })
          .run();
      }
    }

    const restore = (from: string, to: string) => {
      const source = join(datasetDir, FILES_DIR, from);
      if (!existsSync(source)) return false;
      const target = join(snapshotsDir, to);
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(source, target);
      return true;
    };

    const pageOf = new Map<number, { id: number; collectionId: number; institutionId: number }>();
    for (const { id, functionKey, snapshotPath, ...page } of data.pages) {
      const collectionId = collectionIdOf.get(page.collectionId) as number;
      const inserted = db
        .insert(collectionPages)
        .values({
          ...page,
          collectionId,
          routeId: routeIdOf.get(page.routeId) as number,
          functionId: fnId(functionKey),
          evaluatedAt: toDate(page.evaluatedAt),
        })
        .returning({ id: collectionPages.id })
        .get();
      if (snapshotPath) {
        const newPath = `${collectionId}/${inserted.id}.html.gz`;
        const restored =
          restore(snapshotPath, newPath) &&
          restore(resultsPathOf(snapshotPath), resultsPathOf(newPath));
        db.update(collectionPages)
          .set({ snapshotPath: restored ? newPath : null })
          .where(eq(collectionPages.id, inserted.id))
          .run();
      }
      pageOf.set(id, {
        id: inserted.id,
        collectionId,
        institutionId: institutionOfRoute.get(page.routeId) as number,
      });
    }

    for (const { id: _id, screenshotPath, ...finding } of data.findings) {
      const page = pageOf.get(finding.collectionPageId) as {
        id: number;
        collectionId: number;
        institutionId: number;
      };
      const inserted = db
        .insert(findings)
        .values({
          ...finding,
          collectionPageId: page.id,
          fingerprint: fingerprintOf(finding.ruleId, finding.selector, page.institutionId),
          validatedBy: finding.validatedAt ? demo.id : null,
          validatedAt: toDate(finding.validatedAt),
        })
        .returning({ id: findings.id })
        .get();
      if (screenshotPath) {
        const newPath = `${page.collectionId}/${page.id}/${inserted.id}.jpg`;
        if (restore(screenshotPath, newPath)) {
          db.update(findings)
            .set({ screenshotPath: newPath })
            .where(eq(findings.id, inserted.id))
            .run();
        }
      }
    }

    return { imported: true, collections: data.collections.length };
  });
}
