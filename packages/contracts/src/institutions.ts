import { z } from 'zod';

// Domínios de desenvolvimento/homologação ficam fora da pesquisa (seção 3.1.6).
export const DEV_HOST_PREFIXES = ['dev.', 'hml.', 'homolog.', 'staging.'] as const;

export function isDevHost(host: string): boolean {
  const lower = host.toLowerCase();
  return DEV_HOST_PREFIXES.some(
    (prefix) => lower.startsWith(prefix) || lower.includes(`.${prefix}`),
  );
}

const HOSTNAME =
  /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;

/** Aceita "iftm.edu.br", "https://www.iftm.edu.br/" etc. e guarda só o host em minúsculas. */
export const domainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .transform((value) => value.replace(/^https?:\/\//, '').replace(/\/.*$/, ''))
  .pipe(
    z
      .string()
      .regex(HOSTNAME, 'Informe um domínio válido, como iftm.edu.br.')
      .refine(
        (host) => !isDevHost(host),
        'Domínios de desenvolvimento ou homologação não são auditados.',
      ),
  );

export const institutionSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  acronym: z.string(),
  domain: z.string(),
  active: z.boolean(),
  createdAt: z.string(),
});
export type Institution = z.infer<typeof institutionSchema>;

export const createInstitutionSchema = z.object({
  name: z.string().trim().min(3, 'Informe o nome da instituição.').max(200),
  acronym: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{2,20}$/, 'A sigla deve ter de 2 a 20 letras, números ou hífen.'),
  domain: domainSchema,
  active: z.boolean().optional(),
});
export type CreateInstitutionInput = z.input<typeof createInstitutionSchema>;

export const updateInstitutionSchema = createInstitutionSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo para alterar.');
export type UpdateInstitutionInput = z.input<typeof updateInstitutionSchema>;

export const institutionResponseSchema = z.object({ institution: institutionSchema });
export const institutionListResponseSchema = z.object({ institutions: z.array(institutionSchema) });
