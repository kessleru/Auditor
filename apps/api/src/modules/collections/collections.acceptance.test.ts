import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { runCollect } from '../../cli/collect-command.js';
import type { DB } from '../../db/client.js';
import { collectionPages, findings } from '../../db/schema.js';
import { seed } from '../../db/seeds/seed.js';
import {
  closedPortUrl,
  htmlFixture,
  startLocalSite,
} from '../../infra/auditor/__fixtures__/local-server.js';
import { createPlaywrightAuditor } from '../../infra/auditor/page-auditor.js';
import { HostThrottle } from '../../infra/crawler/throttle.js';
import { createServices } from '../../services.js';
import { loggedInAgent } from '../../test/auth.js';
import { seedInstitutionWithRoutes, tempDir } from '../../test/collections.js';
import { createTestDatabase } from '../../test/db.js';

// Critérios de aceite da Fase 4 com Playwright + axe reais contra HTML servido localmente.

let site: Awaited<ReturnType<typeof startLocalSite>>;
let unreachable: string;
let db: DB;
let snapshots: ReturnType<typeof tempDir>;

const auditors: ReturnType<typeof createPlaywrightAuditor>[] = [];
const newAuditor = () => {
  const auditor = createPlaywrightAuditor({
    userAgent: 'AuditoriaRF/1.0 (+teste)',
    throttle: new HostThrottle(),
    minIntervalMs: 0,
    navigationTimeoutMs: 10_000,
  });
  auditors.push(auditor);
  return auditor;
};

beforeAll(async () => {
  site = await startLocalSite({
    '/': htmlFixture('conforme.html'),
    '/violacoes': htmlFixture('violacoes.html'),
  });
  unreachable = await closedPortUrl();
});

afterAll(async () => {
  await Promise.all(auditors.map((a) => a.close()));
  await site.close();
});

beforeEach(() => {
  db = createTestDatabase();
  seed(db);
  snapshots = tempDir();
});

afterEach(() => snapshots.cleanup());

function localInstitution(withUnreachable = false) {
  return seedInstitutionWithRoutes(db, {
    domain: '127.0.0.1',
    acronym: 'IFLOCAL',
    urls: [
      { url: `${site.origin}/`, functionKey: 'home' },
      { url: `${site.origin}/violacoes`, functionKey: 'admission' },
      ...(withUnreachable ? [{ url: unreachable, functionKey: 'library' }] : []),
    ],
  });
}

/** Achados de uma coleta de forma comparável entre execuções. */
function findingsOf(collectionId: number) {
  return db
    .select({
      url: collectionPages.id,
      ruleId: findings.ruleId,
      selector: findings.selector,
      wcagCriteria: findings.wcagCriteria,
      severity: findings.severity,
      fingerprint: findings.fingerprint,
    })
    .from(findings)
    .innerJoin(collectionPages, eq(collectionPages.id, findings.collectionPageId))
    .where(eq(collectionPages.collectionId, collectionId))
    .all()
    .map(({ url: _url, ...rest }) => rest)
    .sort((a, b) => `${a.ruleId}${a.selector}`.localeCompare(`${b.ruleId}${b.selector}`));
}

describe('aceite da Fase 4', { timeout: 120_000 }, () => {
  it('página local com violações conhecidas gera os achados esperados; falha de rede vira failed', async () => {
    const app = createApp({
      db,
      auditor: newAuditor(),
      discover: null,
      snapshotsDir: snapshots.dir,
    });
    const agent = await loggedInAgent(app, db);
    const { institution } = localInstitution(true);

    const { body } = await agent
      .post('/api/v1/collections')
      .send({ institutionIds: [institution.id] });
    const finished = await app.services.collections.waitForFinish(body.collection.id);

    expect(finished.status).toBe('partial');
    expect(finished.axeVersion).toBe('4.13.0');
    expect(finished.browserVersion).toMatch(/^Chromium /);

    const { pages } = app.services.collections.get(finished.id);
    expect(pages.map((p) => [p.functionKey, p.status])).toEqual([
      ['home', 'done'],
      ['admission', 'done'],
      ['library', 'failed'],
    ]);
    expect(pages[2]?.error).toMatch(/ERR_CONNECTION_REFUSED/);
    expect(pages[0]?.violationsCount).toBe(0);
    expect(pages[1]?.violationsCount).toBe(5);

    expect(
      findingsOf(finished.id).map((f) => [f.ruleId, f.selector, f.wcagCriteria, f.severity]),
    ).toEqual([
      ['color-contrast', 'p', '1.4.3', 'critical'],
      ['html-has-lang', 'html', '3.1.1', 'critical'],
      ['image-alt', '#logo > img', '1.1.1', 'critical'],
      ['label', '#busca', '4.1.2', 'critical'],
      ['link-name', '#logo', '2.4.4, 4.1.2', 'critical'],
    ]);

    const report = app.services.reports.summarizeCollection(finished.id, finished.scope);
    const summary = report.institutions[0]?.summary;
    expect(summary).toMatchObject({
      status: 'evaluated',
      pagesEvaluated: 2,
      pagesFailed: 1,
      distinctProblems: 5,
    });
  });

  it('a CLI e a interface produzem o mesmo resultado para a mesma entrada', async () => {
    const app = createApp({
      db,
      auditor: newAuditor(),
      discover: null,
      snapshotsDir: snapshots.dir,
    });
    const agent = await loggedInAgent(app, db);
    const { institution } = localInstitution();

    const { body } = await agent
      .post('/api/v1/collections')
      .send({ institutionIds: [institution.id], functions: ['home', 'admission'] });
    const viaApi = await app.services.collections.waitForFinish(body.collection.id);

    const cli = createServices(db, {
      auditor: newAuditor(),
      discover: null,
      snapshotsDir: snapshots.dir,
    });
    const output: string[] = [];
    const viaCliId = await runCollect(
      { institution: 'iflocal', functions: 'home,admission' },
      cli,
      (line) => output.push(line),
    );
    const viaCli = cli.collections.get(viaCliId);

    expect(viaCli.collection.scope).toEqual(viaApi.scope);
    expect(viaCli.collection.status).toBe(viaApi.status);
    const counts = (id: number) =>
      app.services.collections
        .get(id)
        .pages.map((p) => [
          p.routeId,
          p.status,
          p.passesCount,
          p.violationsCount,
          p.incompleteCount,
          p.inapplicableCount,
        ]);
    expect(counts(viaCliId)).toEqual(counts(viaApi.id));
    expect(findingsOf(viaCliId)).toEqual(findingsOf(viaApi.id));

    expect(output[0]).toBe(`Coleta #${viaCliId} criada: IFLOCAL, 2 página(s).`);
    expect(output.join('\n')).toMatch(/Versões: axe-core 4\.13\.0 · Chromium \d+/);
    expect(output.join('\n')).toMatch(/IFLOCAL: conformidade .* 5 problema\(s\) distinto\(s\)/);
    // Tempo de carregamento medido pelo navegador, para o relatório de confiabilidade.
    expect(output.join('\n')).toMatch(
      /Carregamento: mediana \d+,\d s, máximo \d+,\d s \(2 página\(s\)\)\./,
    );
    expect(output.at(-1)).toBe(
      'A conformidade cobre apenas critérios verificáveis automaticamente.',
    );
  });
});
