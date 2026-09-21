import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(3333),
  WEB_ORIGIN: z.url().default('http://localhost:5173'),
  DATABASE_PATH: z.string().min(1).default('./data/auditoria.sqlite'),
  SNAPSHOTS_DIR: z.string().min(1).default('./data/snapshots'),
  // Contato no user-agent do crawler (seção 3.1.3); sem ele a descoberta não roda.
  CRAWLER_CONTACT_EMAIL: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.email('CRAWLER_CONTACT_EMAIL deve ser um e-mail.').optional(),
  ),
  CRAWLER_MAX_URLS: z.coerce.number().int().positive().default(200),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).optional(),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Variáveis de ambiente inválidas:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

export const env = loadEnv();
