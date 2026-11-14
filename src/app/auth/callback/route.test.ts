import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';
import { createClient } from '@/lib/supabase/server';

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
    expect(response.cookies.get('bookarium-auth-hint')?.value).toBe('authenticated');
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

  it('redirects to /?auth_error=oauth_failed when OAuth callback contains access_denied without OTP parameters', async () => {
    const request = new Request(
      'http://localhost:3000/auth/callback?error=access_denied&error_description=User+cancelled'
    );
    const response = await GET(request);

    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
    expect(mockVerifyOtp).not.toHaveBeenCalled();
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/?auth_error=oauth_failed'
    );
  });

  it('redirects cross-device PKCE password recovery failures to /?auth_notice=recovery_cross_device', async () => {
    mockExchangeCodeForSession.mockResolvedValueOnce({
      error: {
        name: 'AuthPKCECodeVerifierMissingError',
        message: 'PKCE code verifier not found in storage.',
      },
    });

    const request = new Request(
      'https://bookarium.vercel.app/auth/callback?code=recovery-code&next=%2Faccount%3Ftab%3Dsecurity%26recovery%3Dtrue'
    );
    const response = await GET(request);

    expect(response.headers.get('location')).toBe(
      'https://bookarium.vercel.app/?auth_notice=recovery_cross_device'
    );
  });

  it('preserves ?recovery=true only for verified recovery OTP or recovery PKCE exchanges and strips it otherwise', async () => {
    // 1. Valid recovery OTP keeps ?recovery=true
    mockVerifyOtp.mockResolvedValueOnce({ error: null });
    const recoveryOtpReq = new Request(
      'https://bookarium.vercel.app/auth/callback?token_hash=rec-hash&type=recovery&next=%2Faccount%3Ftab%3Dsecurity%26recovery%3Dtrue'
    );
    const recoveryOtpRes = await GET(recoveryOtpReq);
    expect(recoveryOtpRes.headers.get('location')).toBe(
      'https://bookarium.vercel.app/account?tab=security&recovery=true'
    );

    // 2. Non-recovery OTP (signup) strips tampered ?recovery=true
    mockVerifyOtp.mockResolvedValueOnce({ error: null });
    const tamperedOtpReq = new Request(
      'https://bookarium.vercel.app/auth/callback?token_hash=signup-hash&type=signup&next=%2Faccount%3Ftab%3Dsecurity%26recovery%3Dtrue'
    );
    const tamperedOtpRes = await GET(tamperedOtpReq);
    expect(tamperedOtpRes.headers.get('location')).toBe(
      'https://bookarium.vercel.app/account?tab=security'
    );

    // 3. Verified PKCE recovery exchange (redirectType: 'recovery') keeps ?recovery=true
    mockExchangeCodeForSession.mockResolvedValueOnce({
      data: { user: { id: 'u1' }, session: {}, redirectType: 'recovery' },
      error: null,
    });
    const pkceRecoveryReq = new Request(
      'http://localhost:3000/auth/callback?code=pkce-rec&next=%2Faccount%3Ftab%3Dsecurity%26recovery%3Dtrue'
    );
    const pkceRecoveryRes = await GET(pkceRecoveryReq);
    expect(pkceRecoveryRes.headers.get('location')).toBe(
      'http://localhost:3000/account?tab=security&recovery=true'
    );

    // 4. Non-recovery PKCE exchange (OAuth / signup) strips tampered ?recovery=true
    mockExchangeCodeForSession.mockResolvedValueOnce({
      data: { user: { id: 'u1' }, session: {}, redirectType: null },
      error: null,
    });
    const tamperedPkceReq = new Request(
      'http://localhost:3000/auth/callback?code=oauth-code&next=%2Faccount%3Ftab%3Dsecurity%26recovery%3Dtrue'
    );
    const tamperedPkceRes = await GET(tamperedPkceReq);
    expect(tamperedPkceRes.headers.get('location')).toBe(
      'http://localhost:3000/account?tab=security'
    );
  });

  it('forwards sanitized User-Agent and stamps bookarium-client-ip-sync on non-recovery exchanges only', async () => {
    vi.mocked(createClient).mockClear();

    // Non-recovery PKCE login
    mockExchangeCodeForSession.mockResolvedValueOnce({
      data: { user: { id: 'u1' }, session: {}, redirectType: null },
      error: null,
    });
    const pkceLoginRes = await GET(
      new Request('http://localhost:3000/auth/callback?code=pkce-login', {
        headers: { 'user-agent': 'BookariumBrowser/2.0' },
      })
    );
    expect(createClient).toHaveBeenCalledWith({ userAgent: 'BookariumBrowser/2.0' });
    expect(pkceLoginRes.cookies.get('bookarium-client-ip-sync')?.value).toBe('1');

    // Non-recovery OTP verification
    mockVerifyOtp.mockResolvedValueOnce({
      data: { user: { id: 'u1' }, session: {} },
      error: null,
    });
    const otpLoginRes = await GET(
      new Request('http://localhost:3000/auth/callback?token_hash=signup-hash&type=signup', {
        headers: { 'user-agent': 'BookariumSignup/1.0' },
      })
    );
    expect(createClient).toHaveBeenCalledWith({ userAgent: 'BookariumSignup/1.0' });
    expect(otpLoginRes.cookies.get('bookarium-client-ip-sync')?.value).toBe('1');

    // Recovery OTP flow must omit client-ip-sync cookie
    mockVerifyOtp.mockResolvedValueOnce({
      data: { user: { id: 'u1' }, session: {} },
      error: null,
    });
    const recoveryOtpRes = await GET(
      new Request('http://localhost:3000/auth/callback?token_hash=rec-hash&type=recovery', {
        headers: { 'user-agent': 'BookariumRecovery/1.0' },
      })
    );
    expect(recoveryOtpRes.cookies.get('bookarium-client-ip-sync')).toBeUndefined();

    // Recovery PKCE flow must omit client-ip-sync cookie
    mockExchangeCodeForSession.mockResolvedValueOnce({
      data: { user: { id: 'u1' }, session: {}, redirectType: 'recovery' },
      error: null,
    });
    const recoveryPkceRes = await GET(
      new Request('http://localhost:3000/auth/callback?code=pkce-recovery', {
        headers: { 'user-agent': 'BookariumRecovery/1.0' },
      })
    );
    expect(recoveryPkceRes.cookies.get('bookarium-client-ip-sync')).toBeUndefined();
  });
});
