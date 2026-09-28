import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';

export interface BackupResult {
  dir: string;
  databaseBytes: number;
  snapshotFiles: number;
}

const countFiles = (dir: string): number =>
  readdirSync(dir, { withFileTypes: true }).reduce(
    (sum, entry) =>
      sum + (entry.isDirectory() ? countFiles(join(dir, entry.name)) : entry.isFile() ? 1 : 0),
    0,
  );

/**
 * Cópia do banco e dos snapshots (seção 8.1 do plano) em `<outDir>/auditoria-<data>`. O banco sai
 * pela cópia online do SQLite: fica consistente mesmo com a API no ar gravando (WAL). Os snapshots,
 * as fotos e os resultados do axe são arquivos que só são criados, nunca alterados.
 */
export async function backupData({
  databasePath,
  snapshotsDir,
  outDir,
  now = new Date(),
}: {
  databasePath: string;
  snapshotsDir: string;
  outDir: string;
  now?: Date;
}): Promise<BackupResult> {
  const dir = join(outDir, `auditoria-${now.toISOString().replace(/[:.]/g, '-')}`);
  mkdirSync(dir, { recursive: true });

  const sqlite = new Database(databasePath, { readonly: true, fileMustExist: true });
  try {
    await sqlite.backup(join(dir, 'auditoria.sqlite'));
  } finally {
    sqlite.close();
  }

  let snapshotFiles = 0;
  if (existsSync(snapshotsDir)) {
    cpSync(snapshotsDir, join(dir, 'snapshots'), { recursive: true });
    snapshotFiles = countFiles(join(dir, 'snapshots'));
  }
  return { dir, databaseBytes: statSync(join(dir, 'auditoria.sqlite')).size, snapshotFiles };
}
