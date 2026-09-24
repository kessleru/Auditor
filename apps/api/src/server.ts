import { createApp } from './app.js';
import { env } from './config/env.js';
import { createDatabase } from './db/client.js';
import { runMigrations } from './db/migrate.js';
import { seedReferenceData } from './db/seeds/seed.js';
import { logger } from './shared/logger.js';

const db = createDatabase(env.DATABASE_PATH);
runMigrations(db);
// Funções de página e tarefas-alvo que o código espera (banco antigo ganha as novas).
seedReferenceData(db);

const app = createApp({ db });
// Retomada: coletas interrompidas por reinício voltam para a fila.
app.services.collections.resume();

const server = app.listen(env.API_PORT, () => {
  logger.info(`API em http://localhost:${env.API_PORT}`);
});

async function shutdown(signal: string) {
  logger.info(`${signal} recebido; encerrando.`);
  server.close();
  // Páginas em execução não são esperadas: voltam para a fila na próxima inicialização.
  await app.services.collections.close();
  process.exit(0);
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
