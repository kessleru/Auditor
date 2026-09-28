import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { fingerprintOf } from '../../infra/auditor/axe-mapping.js';
import { createAuthRepository } from '../../modules/auth/auth.repository.js';
import { createAuthService } from '../../modules/auth/auth.service.js';
import { DEMO_AUDITOR } from '../../shared/demo.js';
import { loggedInAgent, testAuditor } from '../../test/auth.js';
import {
  fakeAuditor,
  okOutcome,
  seedInstitutionWithRoutes,
  tempDir,
} from '../../test/collections.js';
import { createTestDatabase } from '../../test/db.js';
import type { DB } from '../client.js';
import {
  collectionPages,
  collections,
  findings,
  functionAbsences,
  inspectionSample,
  institutions,
  routes,
  users,
} from '../schema.js';
import { ensureDemoAuditor, exportDemo, importDemo } from './demo.js';
import { seed } from './seed.js';

let source: { db: DB; snapshots: ReturnType<typeof tempDir> };
let target: { db: DB; snapshots: ReturnType<typeof tempDir> };
let dataset: ReturnType<typeof tempDir>;

const fresh = () => {
  const db = createTestDatabase();
  seed(db);
  return { db, snapshots: tempDir() };
};

beforeEach(() => {
  source = fresh();
  target = fresh();
  dataset = tempDir();
});

afterEach(() => {
  for (const dir of [source.snapshots, target.snapshots, dataset]) dir.cleanup();
});

/** Coleta de demonstração na origem: IFA com duas páginas, um problema confirmado com foto. */
async function demoCollection() {
  const { institution } = seedInstitutionWithRoutes(source.db, {
    domain: 'if-a.edu.br',
    acronym: 'IFA',
    urls: [
      { url: 'https://www.if-a.edu.br', functionKey: 'home' },
      { url: 'https://www.if-a.edu.br/ingresso', functionKey: 'admission' },
    ],
  });
  const demo = ensureDemoAuditor(source.db);
  const app = createApp({
    db: source.db,
    discover: null,
    snapshotsDir: source.snapshots.dir,
    auditor: fakeAuditor(async () =>
      okOutcome(
        [{ rule: 'image-alt', targets: ['img.logo'] }],
        [{ ruleId: 'image-alt', selector: 'img.logo', image: Buffer.from('foto') }],
      ),
    ),
  });
  const created = app.services.collections.create(
    { institutionIds: [institution.id], functions: ['home', 'admission'] },
    demo.id,
  );
  await app.services.collections.waitForFinish(created.id);
  app.services.inspections.setSample(created.id, [institution.id], demo.id);
  const first = source.db.select().from(findings).orderBy(findings.id).get()!;
  app.services.inspections.validate(
    first.id,
    { validation: 'confirmed', note: 'Imagem do logotipo sem alt, conferida na foto.' },
    demo.id,
  );
  return created.id;
}

describe('dados de demonstração', () => {
  it('exporta a coleta e a importa noutro banco, com IDs, caminhos e fingerprints novos', async () => {
    const collectionId = await demoCollection();
    const exported = await exportDemo(source.db, {
      collectionIds: [collectionId],
      snapshotsDir: source.snapshots.dir,
      outDir: dataset.dir,
    });
    expect(exported).toMatchObject({ collections: 1, pages: 2, findings: 2, screenshots: 1 });

    // O destino já tem outra instituição com id 1..N: a IFA ganha outro id aqui.
    seedInstitutionWithRoutes(target.db, {
      domain: 'if-b.edu.br',
      acronym: 'IFB',
      urls: [{ url: 'https://www.if-b.edu.br', functionKey: 'home' }],
    });
    const result = await importDemo(target.db, {
      datasetDir: dataset.dir,
      snapshotsDir: target.snapshots.dir,
    });
    expect(result).toEqual({ imported: true, collections: 1 });

    const ifa = target.db.select().from(institutions).where(eq(institutions.acronym, 'IFA')).get()!;
    const collection = target.db.select().from(collections).get()!;
    expect(collection.status).toBe('completed');
    expect(collection.scopeJson).toEqual({
      institutionIds: [ifa.id],
      functions: ['home', 'admission'],
    });
    expect(collection.finishedAt).toBeInstanceOf(Date);

    const pages = target.db.select().from(collectionPages).all();
    expect(pages).toHaveLength(2);
    for (const page of pages) {
      expect(page.snapshotPath).toBe(`${collection.id}/${page.id}.html.gz`);
      expect(existsSync(join(target.snapshots.dir, page.snapshotPath!))).toBe(true);
      expect(
        existsSync(join(target.snapshots.dir, `${collection.id}/${page.id}.axe.json.gz`)),
      ).toBe(true);
    }

    const imported = target.db.select().from(findings).orderBy(findings.id).all();
    const withPhoto = imported.find((f) => f.screenshotPath)!;
    expect(withPhoto.screenshotPath).toBe(
      `${collection.id}/${withPhoto.collectionPageId}/${withPhoto.id}.jpg`,
    );
    expect(readFileSync(join(target.snapshots.dir, withPhoto.screenshotPath!)).toString()).toBe(
      'foto',
    );
    // Só o exemplo exibido nas telas leva foto; as demais ocorrências ficam sem.
    expect(imported.filter((f) => f.screenshotPath)).toHaveLength(1);
    expect(
      imported.every((f) => f.fingerprint === fingerprintOf('image-alt', 'img.logo', ifa.id)),
    ).toBe(true);
    const demo = target.db.select().from(users).where(eq(users.email, DEMO_AUDITOR.email)).get()!;
    expect(imported.every((f) => f.validation === 'confirmed' && f.validatedBy === demo.id)).toBe(
      true,
    );
    expect(target.db.select().from(inspectionSample).all()).toMatchObject([
      { collectionId: collection.id, institutionId: ifa.id, selectedBy: demo.id },
    ]);

    // Decisões de rota da demonstração entram porque a IFA ainda não tinha nenhuma.
    const ifaRoutes = target.db.select().from(routes).where(eq(routes.institutionId, ifa.id)).all();
    expect(ifaRoutes.map((r) => r.status)).toEqual(['confirmed', 'confirmed']);
    expect(
      target.db
        .select()
        .from(functionAbsences)
        .where(eq(functionAbsences.institutionId, ifa.id))
        .all(),
    ).toHaveLength(11);

    // Importar de novo não duplica nada.
    expect(
      await importDemo(target.db, { datasetDir: dataset.dir, snapshotsDir: target.snapshots.dir }),
    ).toEqual({ imported: false, collections: 0 });
    expect(target.db.select().from(collections).all()).toHaveLength(1);
  });

  it('não muda decisões que o auditor já tomou na instituição', async () => {
    const collectionId = await demoCollection();
    await exportDemo(source.db, {
      collectionIds: [collectionId],
      snapshotsDir: source.snapshots.dir,
      outDir: dataset.dir,
    });
    // No destino, a IFA já tem outra página inicial confirmada e a mesma URL de ingresso sugerida.
    const { institution } = seedInstitutionWithRoutes(target.db, {
      domain: 'if-a.edu.br',
      acronym: 'IFA',
      urls: [{ url: 'https://www.if-a.edu.br/inicio', functionKey: 'home' }],
      markOthersAbsent: false,
    });
    target.db
      .insert(routes)
      .values({
        institutionId: institution.id,
        url: 'https://www.if-a.edu.br/ingresso',
        normalizedUrl: 'https://www.if-a.edu.br/ingresso',
        source: 'crawler',
        status: 'excluded',
        exclusionReason: 'Decisão do auditor.',
      })
      .run();

    await importDemo(target.db, { datasetDir: dataset.dir, snapshotsDir: target.snapshots.dir });

    const byUrl = Object.fromEntries(
      target.db
        .select()
        .from(routes)
        .where(eq(routes.institutionId, institution.id))
        .all()
        .map((r) => [r.url, r.status]),
    );
    expect(byUrl).toEqual({
      'https://www.if-a.edu.br/inicio': 'confirmed',
      // Já existia: fica como o auditor deixou.
      'https://www.if-a.edu.br/ingresso': 'excluded',
      // A página inicial da demonstração entra só como sugestão: a função já tinha rota confirmada.
      'https://www.if-a.edu.br': 'suggested',
    });
    expect(target.db.select().from(collectionPages).all()).toHaveLength(2);
  });

  it('a conta de demonstração não entra no sistema nem vira contato do user-agent', async () => {
    const collectionId = await demoCollection();
    await exportDemo(source.db, {
      collectionIds: [collectionId],
      snapshotsDir: source.snapshots.dir,
      outDir: dataset.dir,
    });
    await importDemo(target.db, { datasetDir: dataset.dir, snapshotsDir: target.snapshots.dir });

    const auth = createAuthService(createAuthRepository(target.db));
    expect(auth.listAuditors()).toEqual([]);
    const app = createApp({ db: target.db, discover: null, auditor: null });
    await loggedInAgent(app, target.db);
    expect(auth.listAuditors().map((a) => a.email)).toEqual([testAuditor.email]);
    const attempt = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: DEMO_AUDITOR.email, password: 'qualquer-senha-longa' });
    expect(attempt.status).toBe(401);
  });

  it('sem pacote de demonstração, não faz nada', async () => {
    writeFileSync(join(dataset.dir, 'leia-me.txt'), 'vazio');
    expect(
      await importDemo(target.db, { datasetDir: dataset.dir, snapshotsDir: target.snapshots.dir }),
    ).toEqual({ imported: false, collections: 0 });
  });
});
