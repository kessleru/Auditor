import { describe, expect, it } from 'vitest';
import { noDataReasonOf } from './domain.js';

describe('noDataReasonOf', () => {
  it.each([
    ['off_domain', null, 'blocked'],
    ['http', 403, 'blocked'],
    ['http', 401, 'blocked'],
    ['http', 429, 'blocked'],
    ['http', 503, 'unavailable'],
    ['http', 404, 'unavailable'],
    ['timeout', null, 'unavailable'],
    ['network', null, 'unavailable'],
    ['tool', null, 'tool'],
    ['not_html', 200, 'other'],
    ['other', null, 'other'],
  ] as const)('%s (HTTP %s) → %s', (kind, httpStatus, reason) => {
    expect(noDataReasonOf(kind, httpStatus)).toBe(reason);
  });
});
