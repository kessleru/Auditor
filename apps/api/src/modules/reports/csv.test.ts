import { describe, expect, it } from 'vitest';
import { toCsv } from './csv.js';

describe('toCsv', () => {
  it('segue a RFC 4180, com BOM e CRLF', () => {
    expect(
      toCsv(
        ['a', 'b'],
        [
          ['x,y', 'diz "oi"'],
          [1, null],
        ],
      ),
    ).toBe('﻿a,b\r\n"x,y","diz ""oi"""\r\n1,\r\n');
  });

  it('neutraliza texto que viraria fórmula na planilha, sem mexer em números', () => {
    const csv = toCsv(['v'], [['=HYPERLINK("x")'], ['+1'], ['-a'], ['@SUM(A1)'], [-0.5], ['a=b']]);
    expect(csv.split('\r\n').slice(1, -1)).toEqual([
      `"'=HYPERLINK(""x"")"`,
      "'+1",
      "'-a",
      "'@SUM(A1)",
      '-0.5',
      'a=b',
    ]);
  });
});
