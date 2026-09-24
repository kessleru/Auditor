import { Command } from 'commander';
import { env } from '../config/env.js';
import { createDatabase } from '../db/client.js';
import { runMigrations } from '../db/migrate.js';
import { seedReferenceData } from '../db/seeds/seed.js';
import { createServices } from '../services.js';
import { runDiscover } from './discover-command.js';

const program = new Command('discover')
  .description(
    'Descobre as rotas de uma instituição (ou de todas as ativas) e mostra as candidatas por função.',
  )
  .option('--institution <sigla|id>', 'instituição (ex.: IFTM)')
  .option('--all', 'todas as instituições ativas, uma de cada vez')
  .option('--top <n>', 'candidatas exibidas por função', '3')
  .parse();

const db = createDatabase(env.DATABASE_PATH);
runMigrations(db);
// Funções de página e tarefas-alvo que o código espera (banco antigo ganha as novas).
seedReferenceData(db);
const services = createServices(db);

try {
  const { ok } = await runDiscover(program.opts(), services, (line) => console.log(line));
  if (ok === 0) process.exitCode = 1;
} catch (err) {
  console.error(`Erro: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
} finally {
  await services.collections.close();
}
