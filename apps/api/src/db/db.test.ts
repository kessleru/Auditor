import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInstitutionSchema, pageFunctionKeys } from '@auditoria-rf/contracts';
import { afterEach, describe, expect, it } from 'vitest';
import { createDatabase } from './client.js';
import { runMigrations } from './migrate.js';
import { institutions, pageFunctions, routes, targetTasks } from './schema.js';
import { federalNetwork } from './seeds/federal-network.js';
import { seed, seedReferenceData } from './seeds/seed.js';
import { createTestDatabase } from '../test/db.js';

const tempDirs: string[] = [];
const abertos: { $client: { close(): void } }[] = [];

afterEach(() => {
  // No Windows a pasta não some enquanto o arquivo do SQLite estiver aberto (EBUSY).
  for (const db of abertos.splice(0)) db.$client.close();
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const freshDatabase = createTestDatabase;

describe('migrations', () => {
  it('criam o banco do zero em arquivo, inclusive a pasta', () => {
    const dir = mkdtempSync(join(tmpdir(), 'auditoria-db-'));
    tempDirs.push(dir);
    const db = createDatabase(join(dir, 'nova', 'auditoria.sqlite'));
    abertos.push(db);
    runMigrations(db);

    const tables = db.$client
      .prepare(
        "select name from sqlite_master where type = 'table' and name not like '\\_\\_%' escape '\\' and name != 'sqlite_sequence'",
      )
      .pluck()
      .all();
    expect(tables).toEqual(
      expect.arrayContaining([
        'users',
        'institutions',
        'page_functions',
        'routes',
        'collections',
        'collection_pages',
        'findings',
        'target_tasks',
        'task_inspections',
        'assistive_checks',
        'sessions',
        'inspection_sample',
      ]),
    );
    expect(tables).toHaveLength(12);
  });

  it('podem ser reaplicadas sem erro', () => {
    const db = freshDatabase();
    expect(() => runMigrations(db)).not.toThrow();
  });

  it('impõem as chaves estrangeiras', () => {
    const db = freshDatabase();
    expect(() =>
      db
        .insert(routes)
        .values({
          institutionId: 999,
          url: 'https://x',
          normalizedUrl: 'https://x',
          source: 'manual',
        })
        .run(),
    ).toThrow(/FOREIGN KEY/);
  });
});

describe('seed', () => {
  it('cria funções de página, tarefas-alvo e a Rede Federal, com o IFTM primeiro', () => {
    const db = freshDatabase();
    seed(db);

    const keys = db
      .select({ key: pageFunctions.key })
      .from(pageFunctions)
      .all()
      .map((r) => r.key);
    expect(keys.sort()).toEqual([...pageFunctionKeys].sort());
    expect(keys).toHaveLength(13);
    // Uma tarefa por função, menos contato (a tarefa de contato é da página inicial).
    expect(db.select().from(targetTasks).all()).toHaveLength(12);

    const [iftm, ...rest] = db.select().from(institutions).all();
    expect(iftm).toMatchObject({ id: 1, acronym: 'IFTM', domain: 'iftm.edu.br', active: true });
    expect(rest).toHaveLength(federalNetwork.length - 1);
    const all = [iftm, ...rest];
    expect(new Set(all.map((i) => i?.acronym)).size).toBe(federalNetwork.length);
    expect(all.filter((i) => i?.acronym.startsWith('IF'))).toHaveLength(38);
    for (const institution of all) {
      expect(createInstitutionSchema.safeParse(institution).success).toBe(true);
    }
    expect(iftm?.createdAt).toBeInstanceOf(Date);
  });

  it('é idempotente', () => {
    const db = freshDatabase();
    seed(db);
    seed(db);

    expect(db.select().from(pageFunctions).all()).toHaveLength(13);
    expect(db.select().from(targetTasks).all()).toHaveLength(12);
    expect(db.select().from(institutions).all()).toHaveLength(federalNetwork.length);
  });

  it('dados de referência sozinhos não cadastram instituições', () => {
    const db = freshDatabase();
    seedReferenceData(db);
    seedReferenceData(db);
    expect(db.select().from(pageFunctions).all()).toHaveLength(13);
    expect(db.select().from(institutions).all()).toHaveLength(0);
  });

  it('não duplica instituição já cadastrada com outro domínio ou outra sigla', () => {
    const db = freshDatabase();
    db.insert(institutions)
      .values([
        { name: 'IFSP', acronym: 'IFSP', domain: 'www.ifsp.edu.br' },
        { name: 'Minha', acronym: 'MEU-IFB', domain: 'ifb.edu.br' },
      ])
      .run();
    seed(db);

    const rows = db.select().from(institutions).all();
    expect(rows).toHaveLength(federalNetwork.length);
    expect(rows.filter((r) => r.acronym === 'IFSP')).toHaveLength(1);
    expect(rows.find((r) => r.domain === 'ifb.edu.br')?.acronym).toBe('MEU-IFB');
  });
});
