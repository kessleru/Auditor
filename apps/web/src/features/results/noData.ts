import { type NoDataReason, noDataReasonLabels } from '@auditoria-rf/contracts';

/** Motivo curto, para células de tabela: "Sem dado: bloqueou a ferramenta". */
const SHORT: Record<NoDataReason, string> = {
  blocked: 'bloqueou a ferramenta',
  unavailable: 'fora do ar ou com erro',
  tool: 'falha da ferramenta',
  other: 'nenhuma página avaliada',
};

export function noDataShort(reason: NoDataReason | null): string {
  return `Sem dado: ${SHORT[reason ?? 'other']}`;
}

/** Explicação completa da ausência de dado, com o motivo e o que ele significa (ADR 0016). */
export function noDataDescription(reason: NoDataReason | null): string {
  const why = `${noDataReasonLabels[reason ?? 'other']} na coleta mais recente.`;
  const next =
    reason === 'blocked'
      ? ' A ferramenta não contorna bloqueios (seria mudar o método); a instituição pode liberar o acesso do user-agent AuditoriaRF.'
      : '';
  return `${why}${next} Isso é registrado como ausência de dado: o portal não recebe nota e fica fora das médias.`;
}
