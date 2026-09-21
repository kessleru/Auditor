import { z } from 'zod';

const idSchema = z.coerce.number().int().positive();

/** Lê um parâmetro de rota numérico; inválido vira 404 (o recurso não existe). */
export function parseId(value: unknown): number {
  const parsed = idSchema.safeParse(value);
  return parsed.success ? parsed.data : 0;
}
