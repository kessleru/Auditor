import { z } from 'zod';

export const MIN_PASSWORD_LENGTH = 6;

// Entrada da CLI create-auditor (não há cadastro pela API).
export const createAuditorSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email('E-mail inválido.')),
  name: z.string().trim().min(1, 'Informe o nome.').max(120),
  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`)
    .max(256),
});

export type CreateAuditorInput = z.input<typeof createAuditorSchema>;
