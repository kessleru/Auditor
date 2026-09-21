import { env } from '../config/env.js';
import { createDatabase } from '../db/client.js';
import { runMigrations } from '../db/migrate.js';
import { seed } from '../db/seeds/seed.js';
import { logger } from '../shared/logger.js';

const db = createDatabase(env.DATABASE_PATH);
runMigrations(db);
seed(db);
logger.info({ database: env.DATABASE_PATH }, 'seed aplicado');
