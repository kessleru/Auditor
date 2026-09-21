import { Command } from 'commander';
import { ZodError } from 'zod';
import { env } from '../config/env.js';
import { createDatabase } from '../db/client.js';
import { runMigrations } from '../db/migrate.js';
import { createAuthRepository } from '../modules/auth/auth.repository.js';
import { createAuthService } from '../modules/auth/auth.service.js';
import { AppError } from '../shared/errors.js';
import { readPassword } from './read-password.js';

// Único jeito de criar auditor: não há cadastro público (seção 7, Fase 2).
const program = new Command('create-auditor')
  .description(
    'Cria a conta de um auditor. A senha é pedida no terminal ou lida da entrada padrão.',
  )
  .requiredOption('--email <email>', 'e-mail usado no login')
  .requiredOption('--name <nome>', 'nome exibido na interface')
  .parse();

const { email, name } = program.opts<{ email: string; name: string }>();

try {
  const password = await readPassword();
  const db = createDatabase(env.DATABASE_PATH);
  runMigrations(db);
  const auditor = await createAuthService(createAuthRepository(db)).createAuditor({
    email,
    name,
    password,
  });
  console.log(`Auditor criado: #${auditor.id} ${auditor.name} <${auditor.email}>`);
} catch (err) {
  const message =
    err instanceof ZodError
      ? err.issues.map((issue) => issue.message).join('\n')
      : err instanceof AppError || err instanceof Error
        ? err.message
        : String(err);
  console.error(`Erro: ${message}`);
  process.exitCode = 1;
}
