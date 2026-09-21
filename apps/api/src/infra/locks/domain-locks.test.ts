import { describe, expect, it } from 'vitest';
import { DomainLocks } from './domain-locks.js';

describe('DomainLocks', () => {
  it('impede duas coletas no mesmo domínio e libera ao fim', () => {
    const locks = new DomainLocks();
    expect(locks.tryAcquire(['iftm.edu.br'], 1)).toBe(true);
    expect(locks.tryAcquire(['IFTM.edu.br'], 2)).toBe(false);
    expect(locks.tryAcquire(['iftm.edu.br'], 1)).toBe(true); // reentrante para o mesmo dono

    locks.release(1);
    expect(locks.tryAcquire(['iftm.edu.br'], 2)).toBe(true);
    expect(locks.holder('iftm.edu.br')).toBe(2);
  });

  it('é tudo ou nada', () => {
    const locks = new DomainLocks();
    locks.tryAcquire(['ifgoiano.edu.br'], 1);
    expect(locks.tryAcquire(['iftm.edu.br', 'ifgoiano.edu.br'], 2)).toBe(false);
    expect(locks.holder('iftm.edu.br')).toBeUndefined();
  });
});
