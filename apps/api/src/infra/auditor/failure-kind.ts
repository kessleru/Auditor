import type { PageFailureKind } from '@auditoria-rf/contracts';

// Motivo agrupado de uma página que falhou, lido da mensagem gravada na coleta. Ler da mensagem (e
// não de uma coluna nova) vale também para as coletas já feitas; os testes amarram cada mensagem
// que o motor produz ao seu grupo, para uma mudança de texto não mudar a contagem sem aviso.

const TOOL =
  /navegador|axe-core executado|Erro interno|Sem conexão com a internet|ERR_INTERNET_DISCONNECTED|ERR_NETWORK_CHANGED/i;
const TIMEOUT = /Tempo esgotado|TimeoutError|Timeout \d+ ?ms/i;
const NOT_HTML = /não é uma página HTML|baixa um arquivo|Download is starting/i;
const NETWORK =
  /net::ERR_|E(?:NOTFOUND|CONNREFUSED|CONNRESET|CONNABORTED|HOSTUNREACH)|DNS|Conexão|Certificado|Redirecionamentos demais|não respondeu a tempo|deixou de responder/i;

export function classifyFailure(error: string | null, httpStatus: number | null): PageFailureKind {
  const text = error ?? '';
  if (/fora do domínio da instituição/i.test(text)) return 'off_domain';
  if ((httpStatus !== null && httpStatus >= 400) || /respondeu HTTP \d{3}/i.test(text)) {
    return 'http';
  }
  if (TOOL.test(text)) return 'tool';
  if (TIMEOUT.test(text)) return 'timeout';
  if (NOT_HTML.test(text)) return 'not_html';
  if (NETWORK.test(text)) return 'network';
  return 'other';
}
