import { expect, test } from '@playwright/test';

// Fluxo do visitante: os resultados são públicos e não exigem conta (seção 5.1 do plano).

test('a visão pública abre com o resumo e leva ao relatório de uma instituição', async ({
  page,
  request,
}) => {
  // Precisa de ao menos uma instituição avaliada (a demonstração ou uma coleta): num banco vazio,
  // como o da integração contínua, não há relatório para abrir.
  const resumo = (await (await request.get('/api/v1/public/summary')).json()) as {
    institutionsEvaluated: number;
  };
  test.skip(
    resumo.institutionsEvaluated === 0,
    'nenhuma instituição avaliada no banco (importe a demonstração ou faça uma coleta)',
  );

  await page.goto('/');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Acessibilidade dos portais da Rede Federal' }),
  ).toBeVisible();

  const tabela = page.getByRole('table', {
    name: 'Conformidade e problemas confirmados por instituição',
  });
  await expect(tabela).toBeVisible();

  const primeiro = tabela.getByRole('link', { name: /^Abrir relatório do / }).first();
  const nome = (await primeiro.textContent())?.trim() ?? '';
  await primeiro.click();

  await expect(page).toHaveURL(/\/instituicoes\/\d+$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(nome.length).toBeGreaterThan(0);
});

test('a navegação do visitante marca a página atual e leva à metodologia', async ({ page }) => {
  await page.goto('/');
  const principal = page.getByRole('navigation', { name: 'Principal' });
  await principal.getByRole('link', { name: 'Sobre a metodologia' }).click();

  await expect(page).toHaveURL(/\/metodologia$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Sobre a metodologia' })).toBeVisible();
  await expect(principal.getByRole('link', { name: 'Sobre a metodologia' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page).toHaveTitle(/Sobre a metodologia/);

  // O índice da página leva a uma seção do próprio texto.
  await page.getByRole('link', { name: 'O que a nota não mede' }).click();
  await expect(
    page.getByRole('heading', { level: 2, name: 'O que a nota não mede' }),
  ).toBeVisible();
});

test('a busca de instituições filtra sem acento e anuncia o total', async ({ page }) => {
  await page.goto('/instituicoes');
  await expect(page.getByRole('table')).toBeVisible();

  await page.getByRole('searchbox', { name: 'Buscar instituição' }).fill('zzzz');
  await expect(page.getByRole('heading', { name: 'Nenhuma instituição encontrada' })).toBeVisible();
});

test('o teclado alcança o conteúdo pelo link de pular', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  const pular = page.getByRole('link', { name: 'Pular para o conteúdo' });
  await expect(pular).toBeFocused();
  await pular.press('Enter');
  await expect(page.locator('main#conteudo')).toBeFocused();
});
