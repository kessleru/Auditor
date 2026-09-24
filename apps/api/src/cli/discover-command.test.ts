import { beforeEach, describe, expect, it } from 'vitest';
import type { DB } from '../db/client.js';
import { seed } from '../db/seeds/seed.js';
import { fakeSite, html, links } from '../infra/crawler/__fixtures__/site.js';
import { discoverRoutes } from '../infra/crawler/index.js';
import { createServices } from '../services.js';
import { createTestDatabase } from '../test/db.js';
import { DiscoverCommandError, runDiscover } from './discover-command.js';

const ORIGIN = 'https://www.iftm.edu.br';

// Portal falso: a CLI usa a descoberta real sobre ele, sem rede.
const site = () =>
  fakeSite({
    'https://iftm.edu.br/robots.txt': { redirect: `${ORIGIN}/robots.txt` },
    [`${ORIGIN}/robots.txt`]: { status: 404, body: '' },
    [`${ORIGIN}/`]: {
      body: html(
        'IFTM',
        `<nav>${links(['/ingresso', 'Ingresso'], ['/biblioteca', 'Biblioteca'])}</nav>` +
          links('/noticias/2026/05/processo-seletivo-aberto'),
      ),
    },
    [`${ORIGIN}/ingresso`]: { body: html('Ingresso') },
    [`${ORIGIN}/biblioteca`]: { body: html('Bibliotecas do IFTM') },
    [`${ORIGIN}/noticias/2026/05/processo-seletivo-aberto`]: {
      body: html('Processo seletivo aberto'),
    },
  });

let db: DB;
beforeEach(() => {
  db = createTestDatabase();
  seed(db);
});

const servicesFor = (fake: ReturnType<typeof site> | null) =>
  createServices(db, {
    discover: fake
      ? (domain, checkUrls) =>
          discoverRoutes({ domain, client: fake.client, robotsAgent: 'AuditoriaRF', checkUrls })
      : () => Promise.reject(new Error('Falha ao acessar o portal: ENOTFOUND')),
    auditor: null,
  });

describe('npm run discover', () => {
  it('descobre, grava como sugestão e mostra as candidatas mais relevantes primeiro', async () => {
    const services = servicesFor(site());
    const lines: string[] = [];
    const result = await runDiscover({ institution: 'iftm' }, services, (l) => lines.push(l));
    const out = lines.join('\n');

    expect(result).toEqual({ ok: 1, failed: 0 });
    expect(out).toContain('== IFTM (iftm.edu.br)');
    expect(out).toContain('4 URL(s) em https://www.iftm.edu.br por rastreamento');
    const admission = lines.findIndex((l) => l.includes('Ingresso: 2 candidata(s)'));
    expect(lines[admission + 1]).toContain(`${ORIGIN}/ingresso — Ingresso`);
    expect(lines[admission + 2]).toContain('/noticias/2026/05/processo-seletivo-aberto');
    expect(out).toContain('Editais de auxílio estudantil: nenhuma candidata');
    expect(out).toContain('Nada foi confirmado');
    expect(services.routes.list(1).every((r) => r.status !== 'confirmed')).toBe(true);
  });

  it('com --all, segue para a próxima instituição quando uma falha', async () => {
    const lines: string[] = [];
    const result = await runDiscover({ all: true, top: '1' }, servicesFor(null), (l) =>
      lines.push(l),
    );
    expect(result.ok).toBe(0);
    expect(result.failed).toBeGreaterThan(40);
    expect(lines.filter((l) => l.startsWith('Falhou: Falha ao acessar'))).toHaveLength(
      result.failed,
    );
  });

  it('valida os argumentos', async () => {
    const services = servicesFor(site());
    await expect(runDiscover({}, services, () => {})).rejects.toBeInstanceOf(DiscoverCommandError);
    await expect(runDiscover({ institution: 'XYZ' }, services, () => {})).rejects.toThrow(
      /não encontrada/,
    );
    await expect(
      runDiscover({ institution: 'IFTM', top: '0' }, services, () => {}),
    ).rejects.toThrow(/--top/);
  });
});
