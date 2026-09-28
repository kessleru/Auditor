/**
 * Conta que assina as coletas de demonstração (ADR 0015). Não entra no sistema (a senha é um hash
 * de segredo descartado) e não conta como auditor: nunca vira o contato do user-agent.
 */
export const DEMO_AUDITOR = {
  email: 'demonstracao@auditoria-rf.invalid',
  name: 'Demonstração (coleta de exemplo)',
} as const;
