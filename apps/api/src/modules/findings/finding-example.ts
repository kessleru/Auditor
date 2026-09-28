import type { FindingEvidence, FindingExample } from '@auditoria-rf/contracts';

/** Endereço da foto do achado (ADR 0014), servido por `GET /findings/:id/screenshot`. */
export const screenshotUrlOf = (findingId: number) => `/api/v1/findings/${findingId}/screenshot`;

/** Exemplo de um problema para a interface: código, foto e evidência do achado representante. */
export function findingExample(row: {
  id: number;
  pageUrl: string;
  selector: string;
  htmlSnippet: string;
  screenshotPath: string | null;
  evidenceJson: FindingEvidence | null;
}): FindingExample {
  return {
    findingId: row.id,
    pageUrl: row.pageUrl,
    selector: row.selector,
    htmlSnippet: row.htmlSnippet,
    screenshotUrl: row.screenshotPath ? screenshotUrlOf(row.id) : null,
    evidence: row.evidenceJson,
  };
}
