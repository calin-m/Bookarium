import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';

const mockExchangeCodeForSession = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: {
      exchangeCodeForSession: mockExchangeCodeForSession,
    },
  }),
}));

describe('Auth Callback Route Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exchanges code for session and redirects to destination', async () => {
    mockExchangeCodeForSession.mockResolvedValueOnce({ error: null });

    const req = new Request('http://localhost:3000/auth/callback?code=valid-code&next=/bookshelf');
    const res = await GET(req);

    expect(mockExchangeCodeForSession).toHaveBeenCalledWith('valid-code');
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/bookshelf');
  });

  it('redirects with auth error if exchange fails or code is missing', async () => {
    const req = new Request('http://localhost:3000/auth/callback');
    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('auth_error=verification_failed');
  });
});