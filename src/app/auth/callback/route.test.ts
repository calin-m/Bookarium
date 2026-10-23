import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';

const mockExchangeCodeForSession = vi.fn();
const mockVerifyOtp = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      exchangeCodeForSession: mockExchangeCodeForSession,
      verifyOtp: mockVerifyOtp,
    },
  })),
}));

describe('GET /auth/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exchanges PKCE code for session and redirects to sanitized next path on localhost', async () => {
    mockExchangeCodeForSession.mockResolvedValueOnce({ error: null });

    const request = new Request(
      'http://localhost:3000/auth/callback?code=valid-pkce-code&next=/account'
    );
    const response = await GET(request);

    expect(mockExchangeCodeForSession).toHaveBeenCalledWith('valid-pkce-code');
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost:3000/account');
  });

  it('normalizes Vercel preview deployment origins to the canonical production domain', async () => {
    mockExchangeCodeForSession.mockResolvedValueOnce({ error: null });

    const request = new Request(
      'https://bookarium-git-master-calin.vercel.app/auth/callback?code=preview-code'
    );
    const response = await GET(request);

    expect(mockExchangeCodeForSession).toHaveBeenCalledWith('preview-code');
    expect(response.headers.get('location')).toBe('https://bookarium.vercel.app/');
  });

  it('redirects to /?auth_notice=email_verified when PKCE code exchange fails due to cross-device missing code_verifier', async () => {
    mockExchangeCodeForSession.mockResolvedValueOnce({
      error: {
        name: 'AuthPKCECodeVerifierMissingError',
        message: 'PKCE code verifier not found in storage.',
      },
    });

    const request = new Request(
      'https://bookarium.vercel.app/auth/callback?code=cross-device-code'
    );
    const response = await GET(request);

    expect(response.headers.get('location')).toBe(
      'https://bookarium.vercel.app/?auth_notice=email_verified'
    );
  });

  it('redirects to /?auth_notice=email_verified when PKCE code exchange fails with flow_state_not_found', async () => {
    mockExchangeCodeForSession.mockResolvedValueOnce({
      error: {
        name: 'AuthApiError',
        message: 'Flow state not found',
        code: 'flow_state_not_found',
      },
    });

    const request = new Request(
      'https://bookarium.vercel.app/auth/callback?code=another-cross-device-code'
    );
    const response = await GET(request);

    expect(response.headers.get('location')).toBe(
      'https://bookarium.vercel.app/?auth_notice=email_verified'
    );
  });

  it('verifies token_hash and type via verifyOtp for stateless cross-device email confirmation', async () => {
    mockVerifyOtp.mockResolvedValueOnce({ error: null });

    const request = new Request(
      'https://bookarium.vercel.app/auth/callback?token_hash=hash-123&type=signup&next=/bookshelf'
    );
    const response = await GET(request);

    expect(mockVerifyOtp).toHaveBeenCalledWith({
      token_hash: 'hash-123',
      type: 'signup',
    });
    expect(response.headers.get('location')).toBe(
      'https://bookarium.vercel.app/bookshelf'
    );
  });

  it('redirects to /?auth_error=verification_failed when upstream error query param is present', async () => {
    const request = new Request(
      'https://bookarium-preview.vercel.app/auth/callback?error=access_denied&error_code=otp_expired'
    );
    const response = await GET(request);

    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
    expect(mockVerifyOtp).not.toHaveBeenCalled();
    expect(response.headers.get('location')).toBe(
      'https://bookarium.vercel.app/?auth_error=verification_failed'
    );
  });

  it('redirects to /?auth_error=verification_failed when verifyOtp fails or parameters are missing', async () => {
    mockVerifyOtp.mockResolvedValueOnce({
      error: { message: 'Token has expired or is invalid' },
    });

    const failedOtpRequest = new Request(
      'http://localhost:3000/auth/callback?token_hash=expired-hash&type=email'
    );
    const failedOtpResponse = await GET(failedOtpRequest);
    expect(failedOtpResponse.headers.get('location')).toBe(
      'http://localhost:3000/?auth_error=verification_failed'
    );

    const emptyRequest = new Request('http://localhost:3000/auth/callback');
    const emptyResponse = await GET(emptyRequest);
    expect(emptyResponse.headers.get('location')).toBe(
      'http://localhost:3000/?auth_error=verification_failed'
    );
  });

  it('redirects to /?auth_error=verification_failed when exchangeCodeForSession fails with a generic error', async () => {
    mockExchangeCodeForSession.mockResolvedValueOnce({
      error: { name: 'AuthApiError', message: 'Invalid grant' },
    });

    const request = new Request(
      'http://localhost:3000/auth/callback?code=expired-code'
    );
    const response = await GET(request);

    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/?auth_error=verification_failed'
    );
  });
});
