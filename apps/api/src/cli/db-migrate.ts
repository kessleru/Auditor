import { env } from '../config/env.js';
import { createDatabase } from '../db/client.js';
import { runMigrations } from '../db/migrate.js';
import { logger } from '../shared/logger.js';

runMigrations(createDatabase(env.DATABASE_PATH));
logger.info({ database: env.DATABASE_PATH }, 'migrations aplicadas');
