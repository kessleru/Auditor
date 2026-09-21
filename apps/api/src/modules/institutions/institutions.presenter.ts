import type { Institution } from '@auditoria-rf/contracts';
import type { InstitutionRow } from './institutions.repository.js';

export const toInstitution = (row: InstitutionRow): Institution => ({
  id: row.id,
  name: row.name,
  acronym: row.acronym,
  domain: row.domain,
  active: row.active,
  createdAt: row.createdAt.toISOString(),
});
