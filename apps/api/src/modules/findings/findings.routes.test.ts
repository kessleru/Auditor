import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import type { DB } from '../../db/client.js';
import { findings } from '../../db/schema.js';
import { seed } from '../../db/seeds/seed.js';
import { loggedInAgent } from '../../test/auth.js';
import {
  fakeAuditor,
  okOutcome,
  seedInstitutionWithRoutes,
  tempDir,
} from '../../test/collections.js';
import { createTestDatabase } from '../../test/db.js';

let db: DB;
let snapshots: ReturnType<typeof tempDir>;

beforeEach(() => {
  db = createTestDatabase();
  seed(db);
  snapshots = tempDir();
});

afterEach(() => snapshots.cleanup());

/** Coleta de uma página com dois achados de image-alt; só `img.logo` tem foto. */
async function collected() {
  const { institution } = seedInstitutionWithRoutes(db, {
    domain: 'if-a.edu.br',
    acronym: 'IFA',
    urls: [{ url: 'https://www.if-a.edu.br', functionKey: 'home' }],
  });
  const app = createApp({
    db,
    discover: null,
    snapshotsDir: snapshots.dir,
    auditor: fakeAuditor(async () =>
      okOutcome(
        [{ rule: 'image-alt', targets: ['img.logo', 'img.banner'] }],
        [{ ruleId: 'image-alt', selector: 'img.logo', image: Buffer.from('foto-jpeg') }],
      ),
    ),
  });
  const agent = await loggedInAgent(app, db);
  const { body } = await agent
    .post('/api/v1/collections')
    .send({ institutionIds: [institution.id], functions: ['home'] });
  await app.services.collections.waitForFinish(body.collection.id);
  const rows = db.select().from(findings).all();
  const withPhoto = rows.find((f) => f.selector === 'img.logo')!;
  const withoutPhoto = rows.find((f) => f.selector === 'img.banner')!;
  return { app, agent, withPhoto, withoutPhoto };
}

const url = (id: number) => `/api/v1/findings/${id}/screenshot`;

describe('GET /api/v1/findings/:id/screenshot', () => {
  it('o auditor vê a foto de qualquer achado; sem foto, 404', async () => {
    const { agent, withPhoto, withoutPhoto } = await collected();
    const res = await agent.get(url(withPhoto.id)).buffer(true);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/jpeg');
    expect(Buffer.from(res.body).toString()).toBe('foto-jpeg');
    expect((await agent.get(url(withoutPhoto.id))).status).toBe(404);
    expect((await agent.get(url(9999))).status).toBe(404);
  });

  it('sem sessão, só a foto de achado confirmado (a visão pública só mostra confirmados)', async () => {
    const { app, withPhoto } = await collected();
    expect((await request(app).get(url(withPhoto.id))).status).toBe(404);

    db.update(findings).set({ validation: 'confirmed' }).where(eq(findings.id, withPhoto.id)).run();
    expect((await request(app).get(url(withPhoto.id))).status).toBe(200);
  });
});
