import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { DB } from './client.js';

const migrationsFolder = fileURLToPath(new URL('./migrations', import.meta.url));

/** Aplica as migrations pendentes; idempotente. */
export function runMigrations(db: DB) {
  migrate(db, { migrationsFolder });
}
