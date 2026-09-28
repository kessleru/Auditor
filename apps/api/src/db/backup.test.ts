import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { tempDir } from '../test/collections.js';
import { backupData } from './backup.js';
import { createDatabase } from './client.js';
import { runMigrations } from './migrate.js';
import { institutions } from './schema.js';

let temp: ReturnType<typeof tempDir>;

beforeEach(() => {
  temp = tempDir();
});

afterEach(() => temp.cleanup());

describe('backupData', () => {
  it('copia o banco (com a API aberta) e os snapshots para uma pasta com a data', async () => {
    const databasePath = join(temp.dir, 'data', 'auditoria.sqlite');
    const db = createDatabase(databasePath);
    runMigrations(db);
    db.insert(institutions)
      .values({ name: 'Instituto A', acronym: 'IFA', domain: 'if-a.edu.br' })
      .run();
    const snapshotsDir = join(temp.dir, 'data', 'snapshots');
    mkdirSync(join(snapshotsDir, '1', '2'), { recursive: true });
    writeFileSync(join(snapshotsDir, '1', '2.html.gz'), 'html');
    writeFileSync(join(snapshotsDir, '1', '2', '3.jpg'), 'foto');

    const result = await backupData({
      databasePath,
      snapshotsDir,
      outDir: join(temp.dir, 'backups'),
      now: new Date('2026-09-28T12:34:56.789Z'),
    });

    expect(result.dir).toBe(join(temp.dir, 'backups', 'auditoria-2026-09-28T12-34-56-789Z'));
    expect(result.snapshotFiles).toBe(2);
    expect(result.databaseBytes).toBeGreaterThan(0);
    const copy = new Database(join(result.dir, 'auditoria.sqlite'), { readonly: true });
    expect(copy.prepare('select acronym from institutions').all()).toEqual([{ acronym: 'IFA' }]);
    copy.close();
    expect(readFileSync(join(result.dir, 'snapshots', '1', '2', '3.jpg'), 'utf8')).toBe('foto');
    db.$client.close();
  });

  it('sem pasta de snapshots, copia só o banco', async () => {
    const databasePath = join(temp.dir, 'auditoria.sqlite');
    const db = createDatabase(databasePath);
    runMigrations(db);
    const result = await backupData({
      databasePath,
      snapshotsDir: join(temp.dir, 'nao-existe'),
      outDir: join(temp.dir, 'backups'),
    });
    expect(result.snapshotFiles).toBe(0);
    db.$client.close();
  });

  it('banco inexistente é erro, sem criar um vazio', async () => {
    await expect(
      backupData({
        databasePath: join(temp.dir, 'nao-existe.sqlite'),
        snapshotsDir: temp.dir,
        outDir: join(temp.dir, 'backups'),
      }),
    ).rejects.toThrow();
  });
});
