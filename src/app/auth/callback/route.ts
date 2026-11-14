import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { STORAGE_KEYS } from '@/config/site-config';
import {
  sanitizeRedirectPath,
  resolveCanonicalAuthOrigin,
  isRecoveryRedirectPath,
  stripRecoveryFromRedirectPath,
} from '@/lib/redirect-sanitizer';

const VALID_OTP_TYPES = new Set<EmailOtpType>([
  'signup',
  'email',
  'recovery',
  'magiclink',
  'invite',
  'email_change',
]);

function isValidEmailOtpType(value: string | null): value is EmailOtpType {
  return value !== null && VALID_OTP_TYPES.has(value as EmailOtpType);
}

function isCrossDevicePkceVerifierError(
  error: { name?: string; message?: string; code?: string } | null
): boolean {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  const name = (error.name || '').toLowerCase();
  const code = (error.code || '').toLowerCase();
  return (
    name.includes('pkce') ||
    msg.includes('code verifier') ||
    msg.includes('code_verifier') ||
    msg.includes('flow_state') ||
    code === 'flow_state_not_found'
  );
}

function applyClientIpSyncCookie(response: NextResponse, shouldSync: boolean): void {
  if (!shouldSync) return;
  response.cookies.set(STORAGE_KEYS.CLIENT_IP_SYNC, '1', {
    path: '/',
    maxAge: 120,
    sameSite: 'lax',
    httpOnly: false,
  });
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const targetOrigin = resolveCanonicalAuthOrigin(origin);
  const forwardedUserAgent = request.headers.get('user-agent');
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const otpType = searchParams.get('type');
  const upstreamError = searchParams.get('error');
  const upstreamErrorCode = (searchParams.get('error_code') || '').toLowerCase();
  const next = sanitizeRedirectPath(searchParams.get('next'));

  if (upstreamError) {
    const isOtpError =
      upstreamErrorCode.startsWith('otp_') ||
      Boolean(tokenHash) ||
      Boolean(otpType);
    if (isOtpError) {
      return NextResponse.redirect(
        new URL('/?auth_error=verification_failed', targetOrigin)
      );
    }
    return NextResponse.redirect(
      new URL('/?auth_error=oauth_failed', targetOrigin)
    );
  }

  if (tokenHash && isValidEmailOtpType(otpType)) {
    const supabase = await createClient({ userAgent: forwardedUserAgent });
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: otpType,
    });
    if (!error) {
      const isRecoveryFlow = otpType === 'recovery';
      const destination = sanitizeRedirectPath(
        isRecoveryFlow ? next : stripRecoveryFromRedirectPath(next)
      );
      const response = NextResponse.redirect(new URL(destination, targetOrigin));
      response.cookies.set(STORAGE_KEYS.AUTH_HINT, 'authenticated', {
        path: '/',
        maxAge: 2592000,
        sameSite: 'lax',
      });
      applyClientIpSyncCookie(
        response,
        !isRecoveryFlow && !isRecoveryRedirectPath(destination)
      );
      return response;
    }
  }

  if (code) {
    const supabase = await createClient({ userAgent: forwardedUserAgent });
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const redirectType =
        data && typeof data === 'object' && 'redirectType' in data
          ? (data as { redirectType?: string | null }).redirectType
          : undefined;
      const isRecoveryFlow = redirectType === 'recovery';
      const destination = sanitizeRedirectPath(
        isRecoveryFlow ? next : stripRecoveryFromRedirectPath(next)
      );
      const response = NextResponse.redirect(new URL(destination, targetOrigin));
      response.cookies.set(STORAGE_KEYS.AUTH_HINT, 'authenticated', {
        path: '/',
        maxAge: 2592000,
        sameSite: 'lax',
      });
      applyClientIpSyncCookie(
        response,
        !isRecoveryFlow && !isRecoveryRedirectPath(destination)
      );
      return response;
    }

    // When a user signs up on one device/browser and clicks the confirmation email on another
    // (e.g. mobile mail app), Supabase's /auth/v1/verify endpoint has ALREADY confirmed the
    // user's email in PostgreSQL before redirecting with ?code=...
    // Guide them to sign in on this device with a positive confirmation notice, or direct
    // cross-device password reset links to request a fresh link on the current device.
    if (isCrossDevicePkceVerifierError(error)) {
      if (isRecoveryRedirectPath(next)) {
        return NextResponse.redirect(
          new URL('/?auth_notice=recovery_cross_device', targetOrigin)
        );
      }
      return NextResponse.redirect(
        new URL('/?auth_notice=email_verified', targetOrigin)
      );
    }
  }

  // Return the user to the home page with an explicit verification error parameter
  return NextResponse.redirect(
    new URL('/?auth_error=verification_failed', targetOrigin)
  );
}
