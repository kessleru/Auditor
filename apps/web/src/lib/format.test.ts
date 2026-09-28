import { describe, expect, it } from 'vitest';
import { formatDate, formatMonth, formatNumber, formatSeconds } from './format';

describe('format', () => {
  it('datas no horário de Brasília', () => {
    expect(formatDate('2026-09-12T12:00:00.000Z')).toBe('12/09/2026');
    // 01:00 UTC ainda é dia 11 em Brasília.
    expect(formatDate('2026-09-12T01:00:00.000Z')).toBe('11/09/2026');
    expect(formatMonth('2026-09-12T12:00:00.000Z')).toBe('set/26');
    expect(formatMonth('2026-03-01T12:00:00.000Z')).toBe('mar/26');
  });

  it('números com separador de milhar', () => {
    expect(formatNumber(1247)).toBe('1.247');
  });

  it('formata segundos com uma casa, sem mostrar 0,0 s', () => {
    expect(formatSeconds(2345)).toBe('2,3 s');
    expect(formatSeconds(30_000)).toBe('30,0 s');
    expect(formatSeconds(18)).toBe('menos de 0,1 s');
  });
});
