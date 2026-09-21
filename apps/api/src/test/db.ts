import { createDatabase } from '../db/client.js';
import { runMigrations } from '../db/migrate.js';

/** Banco em memória já migrado, isolado por teste. */
export function createTestDatabase() {
  const db = createDatabase(':memory:');
  runMigrations(db);
  return db;
}
