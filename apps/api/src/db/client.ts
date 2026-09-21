import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { type BetterSQLite3Database, drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';

export type DB = BetterSQLite3Database<typeof schema> & { $client: Database.Database };

/** Abre o SQLite em `path` (ou `:memory:`) com WAL e chaves estrangeiras ativas. */
export function createDatabase(path: string): DB {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });

  const sqlite = new Database(path);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  return drizzle({ client: sqlite, schema });
}
