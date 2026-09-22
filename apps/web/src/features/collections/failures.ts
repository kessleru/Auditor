/** Motivo de falha legível, a partir do erro técnico gravado na coleta (tela 2.2). */
export function describeFailure(error: string | null, httpStatus: number | null): string {
  if (httpStatus === 403) return 'Acesso automatizado bloqueado pelo servidor (HTTP 403)';
  if (httpStatus !== null && httpStatus >= 500)
    return `O servidor do portal respondeu com erro (HTTP ${httpStatus})`;
  if (httpStatus !== null && httpStatus >= 400)
    return `A página não foi encontrada ou não está disponível (HTTP ${httpStatus})`;
  const text = error ?? '';
  if (/Timeout|ERR_TIMED_OUT/i.test(text)) return 'Tempo de resposta esgotado após 30 segundos';
  if (/ERR_CERT|SSL|certificate/i.test(text)) return 'Certificado de segurança inválido';
  if (/ERR_NAME_NOT_RESOLVED|ENOTFOUND/i.test(text)) return 'Domínio não encontrado (DNS)';
  if (/ERR_CONNECTION_REFUSED|ECONNREFUSED/i.test(text)) return 'Conexão recusada pelo servidor';
  if (/ERR_CONNECTION_(RESET|CLOSED)|ECONNRESET/i.test(text))
    return 'A conexão foi interrompida pelo servidor';
  return text || 'Falha desconhecida';
}
