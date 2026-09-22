import { describe, expect, it } from 'vitest';
import { parseScope, scopeSearch } from './scope';

describe('escopo na URL', () => {
  it('ida e volta', () => {
    const search = scopeSearch({ institutionIds: [3, 1], functions: ['home', 'library'] });
    expect(search).toBe('?instituicoes=3,1&funcoes=home,library');
    expect(parseScope(new URLSearchParams(search))).toEqual({
      institutionIds: [3, 1],
      functions: ['home', 'library'],
    });
  });

  it('ignora valores inválidos e mantém a ordem canônica das funções', () => {
    expect(
      parseScope(new URLSearchParams('?instituicoes=1,x,-2,1&funcoes=library,xyz,home')),
    ).toEqual({
      institutionIds: [1],
      functions: ['home', 'library'],
    });
  });
});
