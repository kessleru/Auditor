import type { FindingEvidence } from '@auditoria-rf/contracts';
import type { AxeResults } from 'axe-core';
import { evidenceOf, selectorOf } from '../../infra/auditor/axe-mapping.js';
import type { SnapshotStorage } from '../../infra/storage/snapshot-storage.js';
import { NotFoundError } from '../../shared/errors.js';
import type { FindingsRepository } from './findings.repository.js';

/**
 * Regras cuja evidência sai só do resultado do axe salvo, sem o navegador: dá para refazer em
 * coletas antigas. A fonte, a imagem, o link e o campo exigem o elemento aberto e ficam de fora.
 */
export const BACKFILL_RULES = ['color-contrast', 'target-size'] as const;

export function createFindingsService(repo: FindingsRepository, storage: SnapshotStorage) {
  return {
    /**
     * Preenchimento retroativo da evidência (ADR 0014) a partir do `.axe.json.gz` de cada página:
     * só completa achados sem evidência, nunca muda a validação nem o resultado da coleta.
     */
    async backfillEvidence({ collectionId }: { collectionId?: number } = {}) {
      let pages = 0;
      let updated = 0;
      let missingResults = 0;
      for (const page of repo.evaluatedPages(collectionId)) {
        const pending = repo.findingsWithoutEvidence(page.id, BACKFILL_RULES);
        if (pending.length === 0) continue;
        pages++;
        let results: Pick<AxeResults, 'violations'>;
        try {
          results = JSON.parse(await storage.read(storage.resultsPathFor(page.snapshotPath)));
        } catch {
          missingResults++;
          continue;
        }
        const measured = new Map<string, FindingEvidence>();
        for (const rule of results.violations) {
          for (const node of rule.nodes) {
            const evidence = evidenceOf(rule.id, node);
            if (evidence) measured.set(`${rule.id}\n${selectorOf(node.target)}`, evidence);
          }
        }
        for (const finding of pending) {
          const evidence = measured.get(`${finding.ruleId}\n${finding.selector}`);
          if (!evidence) continue;
          repo.setEvidence(finding.id, evidence);
          updated++;
        }
      }
      return { pages, updated, missingResults };
    },

    /**
     * Foto do elemento reprovado (ADR 0014). Sem sessão, só a de achado confirmado: a visão pública
     * mostra só confirmados (ADR 0006). Achado sem foto ou arquivo ausente: 404.
     */
    async screenshot(id: number, { auditor }: { auditor: boolean }): Promise<Buffer> {
      const row = repo.screenshotOf(id);
      if (!row?.screenshotPath || (!auditor && row.validation !== 'confirmed')) {
        throw new NotFoundError('Foto não encontrada.');
      }
      try {
        return await storage.readFile(row.screenshotPath);
      } catch {
        throw new NotFoundError('Foto não encontrada.');
      }
    },
  };
}

export type FindingsService = ReturnType<typeof createFindingsService>;
