import { z } from 'zod';

export const loginRequestSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email('Informe um e-mail válido.')),
  password: z.string().min(1, 'Informe a senha.').max(256),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const authUserSchema = z.object({
  id: z.number().int(),
  email: z.string(),
  name: z.string(),
});
export type AuthUser = z.infer<typeof authUserSchema>;

export const authUserResponseSchema = z.object({ user: authUserSchema });
export type AuthUserResponse = z.infer<typeof authUserResponseSchema>;
