import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClient as createBrowserClient } from './client';
import { createClient as createServerClient } from './server';
import { updateSession } from './middleware';
import { NextRequest } from 'next/server';

vi.mock('@supabase/ssr', () => ({
  createBrowserClient: vi.fn(() => ({
    auth: { getUser: vi.fn() },
  })),
  createServerClient: vi.fn(() => ({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
  })),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: vi.fn().mockReturnValue([]),
    set: vi.fn(),
  }),
}));

describe('Supabase Client Infrastructure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a browser Supabase client with environment variables', () => {
    const client = createBrowserClient();
    expect(client).toBeDefined();
    expect(client.auth).toBeDefined();
  });

  it('creates a server Supabase client with cookie store and invokes cookie helpers', async () => {
    let capturedOptions: any;
    const { createServerClient: mockCreateServerClient } = await import('@supabase/ssr');
    (mockCreateServerClient as any).mockImplementationOnce((_url: string, _key: string, opts: any) => {
      capturedOptions = opts;
      return { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) } };
    });

    const client = await createServerClient();
    expect(client).toBeDefined();
    expect(capturedOptions?.cookies?.getAll).toBeDefined();
    expect(capturedOptions.cookies.getAll()).toEqual([]);

    // Test setAll callback
    capturedOptions.cookies.setAll([
      { name: 'sb-token', value: 'xyz', options: { path: '/' } },
    ]);
  });

  it('handles updateSession middleware for incoming requests and cookies', async () => {
    let middlewareOpts: any;
    const { createServerClient: mockCreateServerClient } = await import('@supabase/ssr');
    (mockCreateServerClient as any).mockImplementationOnce((_url: string, _key: string, opts: any) => {
      middlewareOpts = opts;
      return { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) } };
    });

    const req = new NextRequest('http://localhost:3000/');
    const res = await updateSession(req);
    expect(res).toBeDefined();

    if (middlewareOpts?.cookies) {
      expect(middlewareOpts.cookies.getAll()).toBeDefined();
      middlewareOpts.cookies.setAll([{ name: 'test', value: '123', options: {} }]);
    }
  });

  it('sanitizes Supabase URLs with trailing slashes, /rest/v1, or empty values', async () => {
    const { sanitizeSupabaseUrl } = await import('./client');
    expect(sanitizeSupabaseUrl('https://xyz.supabase.co/rest/v1/')).toBe('https://xyz.supabase.co');
    expect(sanitizeSupabaseUrl('https://xyz.supabase.co/rest/v1')).toBe('https://xyz.supabase.co');
    expect(sanitizeSupabaseUrl('https://xyz.supabase.co///')).toBe('https://xyz.supabase.co');
    expect(sanitizeSupabaseUrl('')).toBe('https://placeholder.supabase.co');
    expect(sanitizeSupabaseUrl(undefined)).toBe('https://placeholder.supabase.co');
  });
});