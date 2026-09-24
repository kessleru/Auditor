import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStopwatch } from './useStopwatch';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-24T10:00:00Z'));
});
afterEach(() => vi.useRealTimers());

describe('useStopwatch', () => {
  it('mede pelo relógio, mesmo que os disparos atrasem (aba em segundo plano)', () => {
    const { result } = renderHook(() => useStopwatch(0, 300));
    act(() => result.current.start());
    // O relógio anda 90 s sem nenhum disparo do temporizador; o próximo já mostra o total.
    vi.setSystemTime(new Date('2026-09-24T10:01:30Z'));
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(result.current.seconds).toBe(90);
  });

  it('pausa, retoma e soma os trechos', () => {
    const { result } = renderHook(() => useStopwatch(10, 300));
    act(() => result.current.start());
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    act(() => result.current.pause());
    expect(result.current).toMatchObject({ seconds: 15, running: false });
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current.seconds).toBe(15);
    act(() => result.current.start());
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(result.current.seconds).toBe(17);
  });

  it('para sozinho no limite e não retoma depois dele', () => {
    const { result } = renderHook(() => useStopwatch(290, 300));
    act(() => result.current.start());
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(result.current).toMatchObject({ seconds: 300, running: false, limitReached: true });
    act(() => result.current.start());
    expect(result.current.running).toBe(false);
    act(() => result.current.reset());
    expect(result.current).toMatchObject({ seconds: 0, limitReached: false });
  });
});
