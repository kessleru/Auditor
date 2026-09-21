import { createApp } from './app.js';
import { env } from './config/env.js';
import { createDatabase } from './db/client.js';
import { runMigrations } from './db/migrate.js';
import { logger } from './shared/logger.js';

runMigrations(createDatabase(env.DATABASE_PATH));

createApp().listen(env.API_PORT, () => {
  logger.info(`API em http://localhost:${env.API_PORT}`);
});
