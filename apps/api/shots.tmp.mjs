// Uso: node shots.mjs <saida> <largura> <nome>=<caminho>[@clique1|clique2] ...
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
const [out, width, ...pages] = process.argv.slice(2);
const base = 'http://localhost:4173';
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: Number(width), height: 900 }, locale: 'pt-BR' });
const page = await context.newPage();
await page.goto(`${base}/entrar`);
await page.getByLabel('E-mail institucional').fill('e2e@iftm.edu.br');
await page.getByRole('textbox', { name: 'Senha' }).fill('senha-e2e-segura-123');
await page.getByRole('button', { name: 'Entrar' }).click();
await page.waitForURL(/painel/);
for (const spec of pages) {
  const [name, rest] = spec.split(/=(.*)/s);
  const [path, clicks] = rest.split('@');
  await page.goto(`${base}${path}`);
  await page.waitForTimeout(1200);
  for (const name of (clicks ?? '').split('|').filter(Boolean)) {
    await page.getByRole('button', { name }).first().click();
    await page.waitForTimeout(300);
  }
  const r = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();
  const h = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  console.log(`${name} @${width}: axe=${r.violations.map((v) => `${v.id}(${v.nodes.length})`).join(',') || 'ok'} hscroll=${h}`);
  await page.screenshot({ path: `${out}/${name}-${width}.png`, fullPage: true });
}
await browser.close();
