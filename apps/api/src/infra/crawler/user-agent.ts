/** Nome do robô usado para casar grupos `User-agent` do robots.txt. */
export const ROBOTS_AGENT = 'AuditoriaRF';

/** User-agent identificável (seção 3.1.3). */
export function buildUserAgent(contactEmail: string): string {
  return `${ROBOTS_AGENT}/1.0 (+pesquisa academica IFTM; contato: ${contactEmail})`;
}
