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
  // Proxy da rede institucional para sair para a internet (crawler e navegador da coleta).
  CRAWLER_PROXY: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.url('CRAWLER_PROXY deve ser uma URL, como http://proxy.iftm.edu.br:3128.').optional(),
  ),
  COLLECTION_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(2),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).optional(),
  // Atrás de proxy reverso (nginx do docker/): quais proxies são confiáveis para X-Forwarded-*.
  // Aceita o mesmo que o `trust proxy` do Express: true/false, número de saltos ou lista
  // (ex.: "uniquelocal"). Sem isso, o limite de login vê todos com o IP do proxy.
  TRUST_PROXY: z
    .string()
    .optional()
    .transform((value): boolean | number | string => {
      if (value === undefined || value === '' || value === 'false') return false;
      if (value === 'true') return true;
      return /^\d+$/.test(value) ? Number(value) : value;
    }),
  // Cookie de sessão `Secure`: "auto" (padrão) marca quando a requisição chegou por HTTPS
  // (direto ou pelo X-Forwarded-Proto de um proxy confiável); "true"/"false" forçam.
  COOKIE_SECURE: z.enum(['auto', 'true', 'false']).default('auto'),
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
