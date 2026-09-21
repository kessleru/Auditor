import type { AuthUser } from '@auditoria-rf/contracts';

declare global {
  namespace Express {
    interface Request {
      /** Auditor autenticado; preenchido por `requireAuditor`. */
      auditor?: AuthUser;
    }
  }
}

export {};
