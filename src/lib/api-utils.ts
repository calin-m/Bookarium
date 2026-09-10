import { NextResponse } from 'next/server';

export interface RateLimitInfo {
  resetMs: number;
  limit: number;
  remaining: number;
}

/**
 * Extracts the client IP address from proxy headers with anti-spoofing precedence:
 * 1. Cloud platform-set headers ('x-vercel-forwarded-for', 'cf-connecting-ip', 'x-real-ip')
 * 2. The rightmost (edge gateway appended) IP from 'x-forwarded-for'
 * 3. Safe fallback to '127.0.0.1'
 */
export function getClientIp(request: Request | { headers: Headers }): string {
  const vercelIp = request.headers.get('x-vercel-forwarded-for');
  if (vercelIp && vercelIp.trim()) {
    return vercelIp.trim();
  }

  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp && cfIp.trim()) {
    return cfIp.trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp && realIp.trim()) {
    return realIp.trim();
  }

  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const parts = forwardedFor.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) {
      return parts[parts.length - 1];
    }
  }

  return '127.0.0.1';
}

/**
 * Generates a standard HTTP 429 Too Many Requests response with appropriate rate-limiting headers.
 */
export function createRateLimitErrorResponse(
  rateLimit: RateLimitInfo,
  message = 'Too many requests. Please slow down and try again.',
  extraBody?: Record<string, unknown>
): NextResponse {
  return NextResponse.json(
    {
      error: message,
      ...extraBody,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(Math.max(1, Math.ceil(rateLimit.resetMs / 1000))),
        'X-RateLimit-Limit': String(rateLimit.limit),
        'X-RateLimit-Remaining': String(rateLimit.remaining),
      },
    }
  );
}

