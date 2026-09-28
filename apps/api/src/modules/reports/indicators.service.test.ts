import { describe, expect, it } from 'vitest';
import { portalHosts } from './indicators.service.js';

describe('portalHosts', () => {
  it('o host do portal é o mais frequente entre os endereços descobertos', () => {
    const hosts = portalHosts([
      { institutionId: 1, url: 'https://portal.if-a.edu.br/' },
      { institutionId: 1, url: 'https://portal.if-a.edu.br/ingresso' },
      { institutionId: 1, url: 'https://biblioteca.if-a.edu.br/' },
      { institutionId: 2, url: 'https://www.if-b.edu.br/' },
    ]);
    expect(hosts.get(1)).toBe('portal.if-a.edu.br');
    expect(hosts.get(2)).toBe('www.if-b.edu.br');
    expect(hosts.get(3)).toBeUndefined();
  });
});
