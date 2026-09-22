import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pageFunctionKeys } from '@auditoria-rf/contracts';
import { afterEach, describe, expect, it } from 'vitest';
import { createDatabase } from './client.js';
import { runMigrations } from './migrate.js';
import { institutions, pageFunctions, routes, targetTasks } from './schema.js';
import { seed } from './seeds/seed.js';
import { createTestDatabase } from '../test/db.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const freshDatabase = createTestDatabase;

describe('migrations', () => {
  it('criam o banco do zero em arquivo, inclusive a pasta', () => {
    const dir = mkdtempSync(join(tmpdir(), 'auditoria-db-'));
    tempDirs.push(dir);
    const db = createDatabase(join(dir, 'nova', 'auditoria.sqlite'));
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
  it('cria funções de página, tarefas-alvo e o IFTM', () => {
    const db = freshDatabase();
    seed(db);

    const keys = db
      .select({ key: pageFunctions.key })
      .from(pageFunctions)
      .all()
      .map((r) => r.key);
    expect(keys.sort()).toEqual([...pageFunctionKeys].sort());
    expect(db.select().from(targetTasks).all()).toHaveLength(5);

    const [iftm, ...rest] = db.select().from(institutions).all();
    expect(rest).toHaveLength(0);
    expect(iftm).toMatchObject({ acronym: 'IFTM', domain: 'iftm.edu.br', active: true });
    expect(iftm?.createdAt).toBeInstanceOf(Date);
  });

  it('é idempotente', () => {
    const db = freshDatabase();
    seed(db);
    seed(db);

    expect(db.select().from(pageFunctions).all()).toHaveLength(5);
    expect(db.select().from(targetTasks).all()).toHaveLength(5);
    expect(db.select().from(institutions).all()).toHaveLength(1);
  });
});
