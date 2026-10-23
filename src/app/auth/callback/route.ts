import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import {
  sanitizeRedirectPath,
  resolveCanonicalAuthOrigin,
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

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const targetOrigin = resolveCanonicalAuthOrigin(origin);
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const otpType = searchParams.get('type');
  const upstreamError = searchParams.get('error');
  const next = sanitizeRedirectPath(searchParams.get('next'));

  if (upstreamError) {
    return NextResponse.redirect(
      new URL('/?auth_error=verification_failed', targetOrigin)
    );
  }

  if (tokenHash && isValidEmailOtpType(otpType)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: otpType,
    });
    if (!error) {
      return NextResponse.redirect(new URL(next, targetOrigin));
    }
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, targetOrigin));
    }

    // When a user signs up on one device/browser and clicks the confirmation email on another
    // (e.g. mobile mail app), Supabase's /auth/v1/verify endpoint has ALREADY confirmed the
    // user's email in PostgreSQL before redirecting with ?code=...
    // Guide them to sign in on this device with a positive confirmation notice.
    if (isCrossDevicePkceVerifierError(error)) {
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
