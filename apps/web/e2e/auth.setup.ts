import { expect, test as setup } from '@playwright/test';
import { ARQUIVO_SESSAO, CREDENCIAIS } from './credenciais';

// A sessão do auditor é criada uma vez e reaproveitada pelos testes. Entrar em cada teste
// esbarraria no limite de 5 tentativas a cada 15 minutos por IP (seção 6 do plano).

setup('entra como auditor e guarda a sessão', async ({ page }) => {
  setup.skip(
    !CREDENCIAIS,
    'defina E2E_AUDITOR_EMAIL e E2E_AUDITOR_PASSWORD (conta criada por `npm run create-auditor`)',
  );

  await page.goto('/entrar');
  await page.getByLabel('E-mail institucional').fill(CREDENCIAIS!.email);
  await page.getByRole('textbox', { name: 'Senha' }).fill(CREDENCIAIS!.senha);
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page).toHaveURL(/\/painel$/);
  await page.context().storageState({ path: ARQUIVO_SESSAO });
});
