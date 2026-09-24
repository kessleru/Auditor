import { describe, expect, it } from 'vitest';
import { crawlerUserAgent } from './services.js';

describe('crawlerUserAgent', () => {
  const auditors = [{ email: 'pesquisa@iftm.edu.br' }, { email: 'outra@iftm.edu.br' }];

  it('usa o contato do .env quando definido', () => {
    expect(crawlerUserAgent('contato@iftm.edu.br', auditors)).toBe(
      'AuditoriaRF/1.0 (+pesquisa academica IFTM; contato: contato@iftm.edu.br)',
    );
  });

  it('sem ele, usa o e-mail do primeiro auditor', () => {
    expect(crawlerUserAgent(undefined, auditors)).toContain('contato: pesquisa@iftm.edu.br');
  });

  it('sem contato nem auditor, não há user-agent (a API responde 503)', () => {
    expect(crawlerUserAgent(undefined, [])).toBeNull();
  });
});
