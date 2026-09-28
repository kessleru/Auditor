import type { SnapshotStorage } from '../../infra/storage/snapshot-storage.js';
import { NotFoundError } from '../../shared/errors.js';
import type { FindingsRepository } from './findings.repository.js';

export function createFindingsService(repo: FindingsRepository, storage: SnapshotStorage) {
  return {
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
