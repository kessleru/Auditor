import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // API_URL permite apontar para outra instância (ex.: verificação com dados de teste).
    proxy: { '/api': process.env.API_URL ?? 'http://localhost:3333' },
    // Só em desenvolvimento: aceita o endereço encaminhado do GitHub Codespaces (porta privada).
    allowedHosts: ['.app.github.dev'],
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
