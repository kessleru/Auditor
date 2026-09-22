import { Command } from 'commander';
import { findingsFromViolations } from '../infra/auditor/axe-mapping.js';
import { createPlaywrightAuditor } from '../infra/auditor/page-auditor.js';

// Dogfooding (Fase 12): o próprio motor de auditoria roda contra o front deste projeto. Um achado
// crítico derruba o build — a ferramenta que mede acessibilidade não pode ser inacessível.

const program = new Command('dogfood')
  .description('Audita as telas públicas do front com o motor do projeto.')
  .requiredOption('--base <url>', 'origem do front já servido, ex.: http://localhost:4173')
  .option(
    '--paths <lista>',
    'caminhos separados por vírgula',
    '/,/instituicoes,/metodologia,/entrar',
  )
  .parse();

const { base, paths } = program.opts<{ base: string; paths: string }>();
const urls = paths.split(',').map((path) => new URL(path.trim(), base).toString());

const auditor = createPlaywrightAuditor({
  userAgent: 'AuditoriaRF/1.0 (+dogfooding)',
  // O front é servido na própria máquina: o intervalo entre requisições protege portais de
  // terceiros (seção 3.1.3), não faz sentido aqui.
  minIntervalMs: 0,
});

let critical = 0;
let moderate = 0;
let failed = 0;

try {
  const versions = await auditor.versions();
  console.log(`axe-core ${versions.axeVersion} · ${versions.browserVersion}`);

  for (const url of urls) {
    const outcome = await auditor.audit(url);
    if (!outcome.ok) {
      failed += 1;
      console.error(`FALHA ${url}: ${outcome.error}`);
      continue;
    }
    // O agrupamento por instituição não vale aqui: 0 é só o identificador do próprio front.
    const findings = findingsFromViolations(outcome.results.violations, 0);
    const criticalHere = findings.filter((finding) => finding.severity === 'critical');
    critical += criticalHere.length;
    moderate += findings.length - criticalHere.length;
    const passes = outcome.results.passes.length;
    console.log(
      `${url} — ${passes} regras aprovadas, ${criticalHere.length} achados críticos, ${
        findings.length - criticalHere.length
      } moderados`,
    );
    for (const finding of criticalHere) {
      console.error(`  CRÍTICO ${finding.ruleId} em ${finding.selector}`);
      console.error(`    ${finding.help}`);
    }
  }
} finally {
  await auditor.close();
}

console.log(`Resumo: ${critical} críticos, ${moderate} moderados, ${failed} páginas com falha.`);
if (critical > 0 || failed > 0) process.exitCode = 1;
