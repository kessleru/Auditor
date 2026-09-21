import type { createInstitutionSchema, updateInstitutionSchema } from '@auditoria-rf/contracts';
import type { z } from 'zod';
import { AppError, NotFoundError } from '../../shared/errors.js';
import type { InstitutionRow, InstitutionsRepository } from './institutions.repository.js';

type CreateInstitution = z.output<typeof createInstitutionSchema>;
type UpdateInstitution = z.output<typeof updateInstitutionSchema>;

export function createInstitutionsService(repo: InstitutionsRepository) {
  const assertDomainFree = (domain: string, exceptId?: number) => {
    const existing = repo.findByDomain(domain);
    if (existing && existing.id !== exceptId) {
      throw new AppError(
        409,
        'DOMAIN_TAKEN',
        `O domínio ${domain} já pertence a ${existing.acronym}.`,
      );
    }
  };

  const get = (id: number): InstitutionRow => {
    const institution = repo.findById(id);
    if (!institution) throw new NotFoundError('Instituição não encontrada.');
    return institution;
  };

  return {
    list: () => repo.list(),

    get,

    create(data: CreateInstitution): InstitutionRow {
      assertDomainFree(data.domain);
      return repo.insert(data);
    },

    update(id: number, data: UpdateInstitution): InstitutionRow {
      get(id);
      if (data.domain) assertDomainFree(data.domain, id);
      return repo.update(id, data) as InstitutionRow;
    },
  };
}

export type InstitutionsService = ReturnType<typeof createInstitutionsService>;
