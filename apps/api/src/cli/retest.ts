import { writeFileSync } from 'node:fs';
import { pageFunctionLabels } from '@auditoria-rf/contracts';
import { Command } from 'commander';
import { env } from '../config/env.js';
import { createDatabase } from '../db/client.js';
import { runMigrations } from '../db/migrate.js';
import { seedReferenceData } from '../db/seeds/seed.js';
import { createServices } from '../services.js';

// Teste-reteste (confiabilidade da auditoria automatizada): as rotas confirmadas de uma
// instituição auditadas mais de uma vez, com o mesmo motor, intervalo e trava da coleta. Rode com
// a API parada ou sem coleta na fila para o mesmo portal. Nada é gravado no banco.
const program = new Command('retest')
  .description(
    'Audita as rotas confirmadas mais de uma vez e mede a concordância entre as rodadas.',
  )
  .requiredOption('--institution <sigla|id>', 'instituição (ex.: IFTM)')
  .option('--rounds <n>', 'rodadas, de 2 a 5', '2')
  .option('--out <arquivo.json>', 'grava o resultado completo em JSON')
  .parse();

const opts = program.opts<{ institution: string; rounds: string; out?: string }>();
const rounds = Number(opts.rounds);
const pct = (value: number | null) =>
  value === null ? '—' : `${(value * 100).toFixed(1).replace('.', ',')}%`;

const db = createDatabase(env.DATABASE_PATH);
runMigrations(db);
seedReferenceData(db);
const services = createServices(db);

try {
  if (!Number.isInteger(rounds) || rounds < 2 || rounds > 5) {
    throw new Error('--rounds precisa ser um inteiro de 2 a 5.');
  }
  const wanted = opts.institution.trim();
  const institution = services.institutions
    .list()
    .find((i) => String(i.id) === wanted || i.acronym.toUpperCase() === wanted.toUpperCase());
  if (!institution) throw new Error(`Instituição não encontrada: ${wanted}.`);

  console.log(`Teste-reteste de ${institution.acronym}: ${rounds} rodadas.`);
  const result = await services.collections.retest(institution.id, rounds);
  for (const page of result.pages) {
    const label = page.functionKey ? pageFunctionLabels[page.functionKey] : 'Página';
    if (page.stable === null) {
      const errors = page.runs.flatMap((r) => (r.ok ? [] : [r.error]));
      console.log(`- ${label} (${page.url}): sem comparação (${errors[0] ?? 'falha'})`);
      continue;
    }
    const conformities = page.runs.map((r) => (r.ok ? pct(r.conformity) : '—')).join(' / ');
    console.log(
      `- ${label} (${page.url}): ${page.stable ? 'igual' : 'diferente'} · regras ${pct(page.ruleAgreement)} · elementos ${pct(page.findingAgreement)} · conformidade ${conformities}${
        page.unstableRules.length > 0 ? ` · regras instáveis: ${page.unstableRules.join(', ')}` : ''
      }`,
    );
  }
  const { summary } = result;
  console.log(
    `Resumo: ${summary.stable} de ${summary.compared} página(s) com resultado idêntico` +
      ` (${summary.pages - summary.compared} sem comparação por falha); concordância média` +
      ` das regras ${pct(summary.meanRuleAgreement)} e dos elementos ${pct(summary.meanFindingAgreement)}.`,
  );
  if (opts.out) {
    writeFileSync(opts.out, JSON.stringify({ ...result, at: new Date().toISOString() }, null, 2));
    console.log(`Resultado completo em ${opts.out}.`);
  }
} catch (err) {
  console.error(`Erro: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
} finally {
  await services.collections.shutdown();
}
