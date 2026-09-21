import { describe, expect, it } from 'vitest';
import { createInstitutionSchema, domainSchema, isDevHost } from './institutions.js';

describe('domainSchema', () => {
  it.each([
    ['iftm.edu.br', 'iftm.edu.br'],
    ['  IFTM.edu.BR ', 'iftm.edu.br'],
    ['https://www.iftm.edu.br/', 'www.iftm.edu.br'],
    ['http://iftm.edu.br/portal/inicio', 'iftm.edu.br'],
  ])('%j → %s', (input, expected) => {
    expect(domainSchema.parse(input)).toBe(expected);
  });

  it.each(['iftm', 'iftm .edu.br', '-a.edu.br', 'hml.iftm.edu.br', 'dev.iftm.edu.br'])(
    'rejeita %j',
    (input) => {
      expect(domainSchema.safeParse(input).success).toBe(false);
    },
  );
});

describe('createInstitutionSchema', () => {
  it('normaliza a sigla', () => {
    const parsed = createInstitutionSchema.parse({
      name: 'Instituto Federal do Triângulo Mineiro',
      acronym: ' iftm ',
      domain: 'iftm.edu.br',
    });
    expect(parsed.acronym).toBe('IFTM');
  });
});

describe('isDevHost', () => {
  it('reconhece prefixos no início ou no meio do host', () => {
    expect(isDevHost('staging.iftm.edu.br')).toBe(true);
    expect(isDevHost('portal.homolog.iftm.edu.br')).toBe(true);
    expect(isDevHost('devolucao.iftm.edu.br')).toBe(false);
  });
});
