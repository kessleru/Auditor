import { resolve } from 'node:path';
import { Command } from 'commander';
import { env } from '../config/env.js';
import { backupData } from '../db/backup.js';

// Backup do banco e dos snapshots (seção 8.1 do plano). Guarde a pasta gerada fora da máquina: a
// CLI de coleta reconstrói uma coleta a partir das rotas, mas não a validação do auditor.
const program = new Command('backup')
  .description('Copia o banco SQLite e a pasta de snapshots para uma pasta com a data.')
  .option('--out <pasta>', 'pasta de destino', './backups')
  .parse();

const { out } = program.opts<{ out: string }>();
try {
  const result = await backupData({
    databasePath: env.DATABASE_PATH,
    snapshotsDir: env.SNAPSHOTS_DIR,
    outDir: resolve(out),
  });
  const megabytes = (result.databaseBytes / 1024 / 1024).toFixed(1).replace('.', ',');
  console.log(
    `Backup em ${result.dir}: banco com ${megabytes} MB e ${result.snapshotFiles} arquivo(s) de snapshot.`,
  );
  console.log('Copie essa pasta para fora desta máquina (outro disco ou nuvem).');
} catch (err) {
  console.error(`Erro: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
}
