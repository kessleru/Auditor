import { defineConfig, devices } from '@playwright/test';
import { ARQUIVO_SESSAO } from './e2e/credenciais';

// Testes de ponta a ponta dos fluxos principais (Fase 12). O front é servido pelo build de
// produção; a API precisa estar no ar em API_URL (contêiner do docker/ ou `npm run dev -w
// @auditoria-rf/api`), porque os fluxos do auditor dependem de dados reais.

const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 4173);
const API_URL = process.env.API_URL ?? 'http://localhost:3333';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  // Suíte enxuta: os fluxos principais, num navegador só. O detalhe das telas é coberto
  // pelos testes de componente com axe (Vitest + Testing Library).
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'on-first-retry',
    locale: 'pt-BR',
  },
  projects: [
    { name: 'setup', testMatch: /auth.setup.ts/ },
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        storageState: ARQUIVO_SESSAO,
      },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: `npm run preview -- --port ${WEB_PORT} --strictPort`,
    url: `http://localhost:${WEB_PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { API_URL },
  },
});
