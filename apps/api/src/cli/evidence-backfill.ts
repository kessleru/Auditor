import { Command } from 'commander';
import { env } from '../config/env.js';
import { createDatabase } from '../db/client.js';
import { runMigrations } from '../db/migrate.js';
import { createServices } from '../services.js';

// Preenche a evidência (contraste e tamanho do alvo) de coletas feitas antes dela existir, a partir
// do resultado do axe salvo em disco (ADR 0014). Não fotografa nada: a página daquele dia não
// existe mais.
const program = new Command('evidence:backfill')
  .description('Refaz a evidência de contraste e de tamanho do alvo das coletas antigas.')
  .option('--collection <id>', 'só esta coleta (padrão: todas)')
  .parse();

const { collection } = program.opts<{ collection?: string }>();
const collectionId = collection === undefined ? undefined : Number(collection);
if (collectionId !== undefined && (!Number.isInteger(collectionId) || collectionId <= 0)) {
  console.error('Erro: --collection precisa de um ID inteiro.');
  process.exitCode = 1;
} else {
  const db = createDatabase(env.DATABASE_PATH);
  runMigrations(db);
  const services = createServices(db, { auditor: null, discover: null });
  const { pages, updated, missingResults } = await services.findings.backfillEvidence({
    collectionId,
  });
  console.log(
    `Evidência preenchida em ${updated} achado(s), de ${pages} página(s) com achados sem evidência.`,
  );
  if (missingResults > 0) {
    console.log(
      `${missingResults} página(s) sem o resultado do axe em ${env.SNAPSHOTS_DIR}: ficaram como estavam.`,
    );
  }
}
