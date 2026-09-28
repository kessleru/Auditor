import { env } from '../config/env.js';
import { createDatabase } from '../db/client.js';
import { runMigrations } from '../db/migrate.js';
import { importDemo } from '../db/seeds/demo.js';
import { seed } from '../db/seeds/seed.js';
import { logger } from '../shared/logger.js';

const db = createDatabase(env.DATABASE_PATH);
runMigrations(db);
seed(db);
logger.info({ database: env.DATABASE_PATH }, 'seed aplicado');

// Coletas de demonstração (ADR 0015): só na primeira vez; depois, nada muda.
if (env.DEMO_DATA === 'true') {
  const demo = await importDemo(db, { snapshotsDir: env.SNAPSHOTS_DIR });
  if (demo.imported) logger.info({ collections: demo.collections }, 'demonstração importada');
}
