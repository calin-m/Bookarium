import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from './server';

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser: vi.fn() },
  })),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

describe('src/lib/supabase/server', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('wires Next.js cookieStore getAll and setAll into createServerClient', async () => {
    const mockGetAll = vi.fn().mockReturnValue([{ name: 'sb-auth', value: 'token' }]);
    const mockSet = vi.fn();
    vi.mocked(cookies).mockResolvedValue({
      getAll: mockGetAll,
      set: mockSet,
    } as never);

    let capturedCookiesAdapter: {
      getAll: () => unknown[];
      setAll: (items: { name: string; value: string; options?: Record<string, unknown> }[]) => void;
    } | null = null;

    vi.mocked(createServerClient).mockImplementationOnce((_url, _key, options) => {
      capturedCookiesAdapter = options.cookies as never;
      return { auth: { getUser: vi.fn() } } as never;
    });

    const client = await createClient();
    expect(client).toBeDefined();
    expect(capturedCookiesAdapter).not.toBeNull();

    expect(capturedCookiesAdapter!.getAll()).toEqual([{ name: 'sb-auth', value: 'token' }]);
    capturedCookiesAdapter!.setAll([
      { name: 'sb-refresh', value: 'val-1', options: { path: '/' } },
    ]);
    expect(mockSet).toHaveBeenCalledWith('sb-refresh', 'val-1', { path: '/' });
  });

  it('gracefully ignores cookieStore.set errors when called from a Server Component', async () => {
    vi.mocked(cookies).mockResolvedValue({
      getAll: vi.fn().mockReturnValue([]),
      set: vi.fn(() => {
        throw new Error('Cookies can only be modified in a Server Action or Route Handler');
      }),
    } as never);

    let capturedCookiesAdapter: {
      setAll: (items: { name: string; value: string; options?: Record<string, unknown> }[]) => void;
    } | null = null;

    vi.mocked(createServerClient).mockImplementationOnce((_url, _key, options) => {
      capturedCookiesAdapter = options.cookies as never;
      return { auth: { getUser: vi.fn() } } as never;
    });

    await createClient();
    expect(() =>
      capturedCookiesAdapter!.setAll([{ name: 'sb-token', value: 'val', options: {} }])
    ).not.toThrow();
  });
});

