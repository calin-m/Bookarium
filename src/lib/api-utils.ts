import { NextResponse } from 'next/server';

export interface RateLimitInfo {
  resetMs: number;
  limit: number;
  remaining: number;
}

/**
 * Extracts the client IP address from standard proxy headers ('x-forwarded-for', 'x-real-ip')
 * with a safe fallback to '127.0.0.1'.
 */
export function getClientIp(request: Request | { headers: Headers }): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const first = forwardedFor.split(',')[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp && realIp.trim()) {
    return realIp.trim();
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

