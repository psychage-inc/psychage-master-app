// PR-003 — directory request timeout. A hung TCP connection must settle as a
// rejection (Error) so TanStack Query's retry/error path engages instead of the
// UI stalling forever on a promise that never resolves.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { withTimeout } from '@/features/directory/queries';

describe('withTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves with the value when the promise settles first', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 1000)).resolves.toBe('ok');
  });

  it('propagates the underlying rejection unchanged', async () => {
    const boom = new Error('boom');
    await expect(withTimeout(Promise.reject(boom), 1000)).rejects.toBe(boom);
  });

  it('rejects with an Error once the deadline passes on a hung promise', async () => {
    const hung = new Promise<never>(() => {});
    const timed = withTimeout(hung, 15_000);
    const assertion = expect(timed).rejects.toThrow('Request timed out after 15000ms');
    vi.advanceTimersByTime(15_000);
    await assertion;
  });

  it('does not reject a promise that settles just inside the window', async () => {
    let resolveSlow: (v: string) => void = () => {};
    const slow = new Promise<string>((resolve) => {
      resolveSlow = resolve;
    });
    const timed = withTimeout(slow, 15_000);
    vi.advanceTimersByTime(14_999);
    resolveSlow('made it');
    await expect(timed).resolves.toBe('made it');
    // Advancing past the deadline after settling must not surface a late rejection.
    vi.advanceTimersByTime(10_000);
  });

  it('defaults the deadline to 15s', async () => {
    const hung = new Promise<never>(() => {});
    const timed = withTimeout(hung);
    const assertion = expect(timed).rejects.toThrow('Request timed out after 15000ms');
    vi.advanceTimersByTime(15_000);
    await assertion;
  });
});
