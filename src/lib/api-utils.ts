import { NextResponse } from 'next/server';

export interface RateLimitInfo {
  resetMs: number;
  limit: number;
  remaining: number;
}

export type ApiCorpPolicy = 'same-origin' | 'cross-origin';

/**
 * Emits hardened response headers protecting Bookarium API payloads from MIME sniffing
 * and cross-origin hotlinking while explicitly permitting `cross-origin` embeds for
 * social OpenGraph reading cards (`?type=card`).
 */
export function buildApiSecurityHeaders(
  corpPolicy: ApiCorpPolicy = 'same-origin'
): Record<string, string> {
  return {
    'X-Content-Type-Options': 'nosniff',
    'Cross-Origin-Resource-Policy': corpPolicy,
  };
}

/**
 * Checks whether incoming URL query parameters include any keys outside the canonical allowlist.
 * Dev-only diagnostic keys (e.g., `?country=XX`) remain permitted in `development` and `test`
 * environments, and are rejected when `NODE_ENV === 'production'`.
 */
export function hasUnexpectedQueryParams(
  searchParams: URLSearchParams,
  allowedKeys: ReadonlySet<string>,
  devOnlyKeys?: ReadonlySet<string>
): boolean {
  const allowDevKeys = process.env.NODE_ENV !== 'production';
  for (const key of searchParams.keys()) {
    if (allowedKeys.has(key)) {
      continue;
    }
    if (allowDevKeys && devOnlyKeys?.has(key)) {
      continue;
    }
    return true;
  }
  return false;
}

/**
 * Builds an uncacheable (`Cache-Control: no-store`) JSON error response with baseline
 * resource-isolation and MIME-sniffing protection headers.
 */
export function createNoStoreErrorResponse(
  message: string,
  status: number,
  extraBody?: Record<string, unknown>,
  corpPolicy: ApiCorpPolicy = 'same-origin'
): NextResponse {
  return NextResponse.json(
    {
      error: message,
      ...extraBody,
    },
    {
      status,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        ...buildApiSecurityHeaders(corpPolicy),
      },
    }
  );
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
  extraBody?: Record<string, unknown>,
  corpPolicy: ApiCorpPolicy = 'same-origin'
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
        'Cache-Control': 'no-store, max-age=0',
        ...buildApiSecurityHeaders(corpPolicy),
      },
    }
  );
}

