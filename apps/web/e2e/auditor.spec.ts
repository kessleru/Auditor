import { expect, test } from '@playwright/test';
import { CREDENCIAIS } from './credenciais';

// Fluxo do auditor. Precisa de uma conta: não há cadastro público (seção 7, Fase 2), então as
// credenciais vêm do ambiente e a CLI `create-auditor` é quem cria a conta.

test.describe('sem sessão', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('senha errada não entra e explica o motivo', async ({ page }) => {
    await page.goto('/entrar');
    await page.getByLabel('E-mail institucional').fill('ninguem@iftm.edu.br');
    await page.getByRole('textbox', { name: 'Senha' }).fill('senha-que-nao-existe');
    await page.getByRole('button', { name: 'Entrar' }).click();

    const alerta = page.getByRole('alert');
    await expect(alerta).toHaveText('E-mail ou senha incorretos.');
    await expect(alerta).toBeFocused();
    await expect(page).toHaveURL(/\/entrar$/);
  });

  test('rota do auditor sem sessão manda para a tela de entrada', async ({ page }) => {
    await page.goto('/painel');
    await expect(page).toHaveURL(/\/entrar/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Entrar como auditor' }),
    ).toBeVisible();
  });

  test('entrar e sair fecha o acesso às telas do auditor', async ({ page }) => {
    test.skip(!CREDENCIAIS, 'defina E2E_AUDITOR_EMAIL e E2E_AUDITOR_PASSWORD');

    // Este teste entra por conta própria: derrubar a sessão compartilhada tiraria os outros do ar.
    await page.goto('/entrar');
    await page.getByLabel('E-mail institucional').fill(CREDENCIAIS!.email);
    await page.getByRole('textbox', { name: 'Senha' }).fill(CREDENCIAIS!.senha);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/painel$/);

    await page.getByRole('button', { name: 'Sair' }).click();
    await expect(page).toHaveURL(/\/entrar/);

    await page.goto('/painel');
    await expect(page).toHaveURL(/\/entrar/);
  });
});

test.describe('com sessão de auditor', () => {
  test.skip(
    !CREDENCIAIS,
    'defina E2E_AUDITOR_EMAIL e E2E_AUDITOR_PASSWORD (conta criada por `npm run create-auditor`)',
  );

  // A sessão vem do projeto de setup, que entra uma vez só: entrar em cada teste esbarraria no
  // limite de 5 tentativas a cada 15 minutos por IP.
  test.beforeEach(async ({ page }) => {
    await page.goto('/painel');
    await expect(page).toHaveURL(/\/painel$/);
  });

  test('o painel leva à configuração de uma auditoria', async ({ page }) => {
    await expect(
      page.getByRole('heading', { level: 1, name: 'Painel de auditoria' }),
    ).toBeVisible();

    await page.getByRole('link', { name: 'Nova auditoria' }).first().click();
    await expect(page).toHaveURL(/\/auditorias\/nova$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Nova auditoria' })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Etapas da auditoria' })).toBeVisible();
  });

  test('a navegação do auditor marca a página atual', async ({ page }) => {
    const lateral = page.getByRole('navigation', { name: 'Principal' });
    await lateral.getByRole('link', { name: 'Comparativo' }).click();

    await expect(page).toHaveURL(/\/comparativo$/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Comparativo entre instituições' }),
    ).toBeVisible();
    await expect(lateral.getByRole('link', { name: 'Comparativo' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});
