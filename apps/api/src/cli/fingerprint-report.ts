import { Command } from 'commander';
import { env } from '../config/env.js';
import { createDatabase } from '../db/client.js';
import { runMigrations } from '../db/migrate.js';
import { createServices } from '../services.js';

// Mede o agrupamento dos problemas numa coleta (ADR 0003): quantos problemas distintos e de
// template saem com a chave atual (regra + seletor) e com outras chaves. Só lê o banco.
const program = new Command('fingerprint:report')
  .description('Compara o agrupamento dos problemas (regra + seletor) com outras chaves.')
  .requiredOption('--collection <id>', 'coleta a analisar')
  .option('--examples <n>', 'exemplos de cada caso por instituição', '5')
  .parse();

const opts = program.opts<{ collection: string; examples: string }>();
const collectionId = Number(opts.collection);
const examples = Number(opts.examples);
if (!Number.isInteger(collectionId) || collectionId <= 0 || !Number.isInteger(examples)) {
  console.error('Erro: --collection e --examples precisam de números inteiros.');
  process.exitCode = 1;
} else {
  const db = createDatabase(env.DATABASE_PATH);
  runMigrations(db);
  const services = createServices(db, { auditor: null, discover: null });
  const report = services.indicators.fingerprintReport(collectionId);
  if (report.length === 0) console.log(`Coleta #${collectionId} sem páginas.`);
  for (const { acronym, analysis } of report) {
    const { selector, selectorWithoutPosition, html } = analysis.byKey;
    console.log(`\n${acronym} — ${analysis.pagesEvaluated} página(s) avaliada(s)`);
    console.log(
      `  regra + seletor (atual):     ${selector.distinct} distintos, ${selector.template} de template`,
    );
    console.log(
      `  regra + seletor sem posição: ${selectorWithoutPosition.distinct} distintos, ${selectorWithoutPosition.template} de template`,
    );
    console.log(
      `  regra + HTML do elemento:    ${html.distinct} distintos, ${html.template} de template`,
    );
    console.log(`  partidos (mesmo HTML, seletores diferentes): ${analysis.split.length}`);
    for (const s of analysis.split.slice(0, examples)) {
      console.log(`    ${s.ruleId}: ${s.html.slice(0, 80)} ← ${s.selectors.join(' | ')}`);
    }
    console.log(`  juntados (mesmo seletor, HTML diferente): ${analysis.merged.length}`);
    for (const m of analysis.merged.slice(0, examples)) {
      console.log(
        `    ${m.ruleId} ${m.selector}: ${m.htmls.map((h) => h.slice(0, 50)).join(' | ')}`,
      );
    }
  }
}
