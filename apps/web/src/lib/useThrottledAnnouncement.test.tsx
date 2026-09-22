import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useThrottledAnnouncement } from './useThrottledAnnouncement';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useThrottledAnnouncement', () => {
  it('anuncia no máximo uma vez a cada 10 s e entrega a última mensagem', () => {
    const { result, rerender } = renderHook(({ msg }) => useThrottledAnnouncement(msg), {
      initialProps: { msg: '0 de 10' },
    });
    rerender({ msg: '1 de 10' });
    act(() => vi.advanceTimersByTime(0));
    expect(result.current).toBe('1 de 10');

    rerender({ msg: '2 de 10' });
    rerender({ msg: '3 de 10' });
    act(() => vi.advanceTimersByTime(9_000));
    expect(result.current).toBe('1 de 10');
    act(() => vi.advanceTimersByTime(1_000));
    expect(result.current).toBe('3 de 10');
  });
});
