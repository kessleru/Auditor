import { Command } from 'commander';
import { ZodError } from 'zod';
import { env } from '../config/env.js';
import { createDatabase } from '../db/client.js';
import { runMigrations } from '../db/migrate.js';
import { createServices } from '../services.js';
import { AppError } from '../shared/errors.js';
import { runCollect } from './collect-command.js';

const program = new Command('collect')
  .description('Executa uma coleta automatizada com as rotas confirmadas de uma instituição.')
  .requiredOption('--institution <sigla|id>', 'instituição (ex.: IFTM)')
  .option('--functions <lista>', 'funções separadas por vírgula (ex.: home,admission)')
  .option('--auditor <e-mail>', 'auditor responsável (obrigatório se houver mais de um)')
  .parse();

const db = createDatabase(env.DATABASE_PATH);
runMigrations(db);
const services = createServices(db);

try {
  await runCollect(program.opts(), services, (line) => console.log(line));
} catch (err) {
  const message =
    err instanceof ZodError
      ? err.issues.map((i) => i.message).join('\n')
      : err instanceof AppError || err instanceof Error
        ? err.message
        : String(err);
  console.error(`Erro: ${message}`);
  process.exitCode = 1;
} finally {
  await services.collections.shutdown();
}
