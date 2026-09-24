import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const apiProxy = { '/api': process.env.API_URL ?? 'http://localhost:3333' };

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // API_URL permite apontar para outra instância (ex.: verificação com dados de teste).
    proxy: apiProxy,
    // Só em desenvolvimento: aceita o endereço encaminhado do GitHub Codespaces (porta privada).
    allowedHosts: ['.app.github.dev'],
  },
  // O build servido por `vite preview` é o que os testes de ponta a ponta usam.
  preview: { proxy: apiProxy },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // e2e/ é do Playwright (`npm run test:e2e`); o Vitest só roda os testes de src/.
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
