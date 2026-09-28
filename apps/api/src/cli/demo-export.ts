import { Command } from 'commander';
import { env } from '../config/env.js';
import { createDatabase } from '../db/client.js';
import { runMigrations } from '../db/migrate.js';
import { DEMO_DATASET_DIR, exportDemo } from '../db/seeds/demo.js';

// Empacota coletas como demonstração (ADR 0015), a partir do banco do .env (ou de DATABASE_PATH).
const program = new Command('demo:export')
  .description('Grava coletas em apps/api/demo, importadas pelo seed a cada subida.')
  .requiredOption('--collections <ids>', 'IDs das coletas, separados por vírgula (ex.: 1,2)')
  .option('--out <pasta>', 'pasta de destino', DEMO_DATASET_DIR)
  .parse();

const { collections, out } = program.opts<{ collections: string; out: string }>();
const collectionIds = collections.split(',').map((id) => Number(id.trim()));
if (collectionIds.some((id) => !Number.isInteger(id) || id <= 0)) {
  console.error('Erro: --collections precisa de IDs inteiros, como 1,2.');
  process.exitCode = 1;
} else {
  const db = createDatabase(env.DATABASE_PATH);
  runMigrations(db);
  const summary = await exportDemo(db, {
    collectionIds,
    snapshotsDir: env.SNAPSHOTS_DIR,
    outDir: out,
  });
  console.log(
    `Demonstração gravada em ${out}: ${summary.collections} coleta(s), ${summary.pages} página(s), ${summary.findings} achado(s), ${summary.screenshots} foto(s).`,
  );
}
