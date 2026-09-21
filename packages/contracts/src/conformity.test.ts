import { describe, expect, it } from 'vitest';
import { classifyConformity } from './conformity.js';

describe('classifyConformity', () => {
  it.each([
    [1, 'good'],
    [0.75, 'good'],
    [0.7499, 'partial'],
    [0.5, 'partial'],
    [0.4999, 'critical'],
    [0, 'critical'],
  ] as const)('%d → %s', (value, expected) => {
    expect(classifyConformity(value)).toBe(expected);
  });
});
