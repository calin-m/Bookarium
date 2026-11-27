import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { unstable_cache } from 'next/cache';
import { createOptionalDataCache } from './server-data-cache';

vi.mock('next/cache', () => ({
  unstable_cache: vi.fn((fn: (...args: unknown[]) => unknown) => fn),
}));

describe('createOptionalDataCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('invokes underlying callback cleanly under VITEST without requiring incrementalCache store', async () => {
    const loader = vi.fn(async (id: number) => `book-${id}`);
    const cached = createOptionalDataCache(loader, ['test-key'], { revalidate: 86400 });

    expect(unstable_cache).toHaveBeenCalledTimes(1);
    await expect(cached(1342)).resolves.toBe('book-1342');
    expect(loader).toHaveBeenCalledWith(1342);
  });

  it('uses unstable_cache invoker outside VITEST and falls back cleanly only when incrementalCache is missing', async () => {
    vi.stubEnv('VITEST', '');
    delete process.env.VITEST;

    const loader = vi.fn(async (id: number) => ({ id, ok: true }));
    const cachedInvoker = vi
      .fn()
      .mockResolvedValueOnce({ id: 84, ok: true })
      .mockRejectedValueOnce(new Error('Invariant: incrementalCache missing in unstable_cache'))
      .mockRejectedValueOnce(new Error('Upstream Supabase timeout'));

    vi.mocked(unstable_cache).mockReturnValueOnce(cachedInvoker as unknown as typeof loader);

    const cached = createOptionalDataCache(loader, ['test-runtime-key'], {
      revalidate: 86400,
      tags: ['catalog'],
    });

    await expect(cached(84)).resolves.toEqual({ id: 84, ok: true });
    expect(cachedInvoker).toHaveBeenCalledTimes(1);

    await expect(cached(11)).resolves.toEqual({ id: 11, ok: true });
    expect(loader).toHaveBeenCalledWith(11);

    await expect(cached(99)).rejects.toThrow('Upstream Supabase timeout');
  });
});
