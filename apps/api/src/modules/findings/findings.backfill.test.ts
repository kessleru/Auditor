import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Result } from 'axe-core';
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

const contrastRule = {
  id: 'color-contrast',
  impact: 'serious',
  tags: ['wcag2aa', 'wcag143'],
  help: 'contraste',
  helpUrl: 'https://dequeuniversity.com/rules/axe/4.13/color-contrast',
  nodes: [
    {
      target: ['p.aviso'],
      html: '<p class="aviso">Inscrições</p>',
      impact: 'serious',
      any: [
        {
          id: 'color-contrast',
          data: {
            fgColor: '#999999',
            bgColor: '#ffffff',
            contrastRatio: 2.85,
            fontSize: '10.5pt (14px)',
            fontWeight: 'normal',
            expectedContrastRatio: '4.5:1',
          },
        },
      ],
      all: [],
      none: [],
    },
  ],
} as unknown as Result;

/** Coleta "antiga": o resultado do axe está salvo, mas o achado ficou sem evidência. */
async function oldCollection() {
  const { institution } = seedInstitutionWithRoutes(db, {
    domain: 'if-a.edu.br',
    acronym: 'IFA',
    urls: [{ url: 'https://www.if-a.edu.br', functionKey: 'home' }],
  });
  const app = createApp({
    db,
    discover: null,
    snapshotsDir: snapshots.dir,
    auditor: fakeAuditor(async () => {
      const outcome = okOutcome([{ rule: 'image-alt', targets: ['img.logo'] }]);
      if (outcome.ok) outcome.results.violations.push(contrastRule);
      return outcome;
    }),
  });
  const agent = await loggedInAgent(app, db);
  const { body } = await agent
    .post('/api/v1/collections')
    .send({ institutionIds: [institution.id], functions: ['home'] });
  await app.services.collections.waitForFinish(body.collection.id);
  db.update(findings).set({ evidenceJson: null }).run();
  return { app, collectionId: body.collection.id as number };
}

describe('backfillEvidence', () => {
  it('refaz a evidência de contraste a partir do resultado do axe salvo', async () => {
    const { app, collectionId } = await oldCollection();
    const contrast = db.select().from(findings).where(eq(findings.ruleId, 'color-contrast')).get()!;
    db.update(findings)
      .set({ validation: 'confirmed', validationNote: 'conferido' })
      .where(eq(findings.id, contrast.id))
      .run();

    expect(await app.services.findings.backfillEvidence({ collectionId })).toEqual({
      pages: 1,
      updated: 1,
      missingResults: 0,
    });
    const after = db.select().from(findings).where(eq(findings.id, contrast.id)).get()!;
    expect(after.evidenceJson).toEqual({
      kind: 'contrast',
      fgColor: '#999999',
      bgColor: '#ffffff',
      contrastRatio: 2.85,
      expectedContrastRatio: 4.5,
      fontSizePx: 14,
      bold: false,
      fontFamily: null,
    });
    // A validação do auditor não muda.
    expect(after).toMatchObject({ validation: 'confirmed', validationNote: 'conferido' });
    // A imagem precisa do elemento aberto: fica sem evidência.
    const image = db.select().from(findings).where(eq(findings.ruleId, 'image-alt')).get()!;
    expect(image.evidenceJson).toBeNull();

    // Idempotente: na segunda vez, nada a fazer.
    expect(await app.services.findings.backfillEvidence()).toEqual({
      pages: 0,
      updated: 0,
      missingResults: 0,
    });
  });

  it('página sem o resultado do axe em disco é contada, sem derrubar o resto', async () => {
    const { app } = await oldCollection();
    snapshots.cleanup();
    expect(await app.services.findings.backfillEvidence()).toEqual({
      pages: 1,
      updated: 0,
      missingResults: 1,
    });
  });
});
