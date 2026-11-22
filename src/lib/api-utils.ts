/**
 * @module src/lib/api-utils
 * @scope Shared HTTP security utilities enforcing API query allowlists, Fetch Metadata isolation (`guardContentAssetRequest`), `nosniff`/`CORP` response headers, HTTPS proxy detection, and rightmost-hop client IP extraction.
 * @invariant Reject unexpected query keys (`hasUnexpectedQueryParams`, restricting dev diagnostic params to `NODE_ENV !== 'production'`), block browser deeplinks and cross-site subresource hotlinks on `/api/books/content*` (`isBlockedContentAssetRequest`, returning `403 no-store` while keeping `type=card` and headerless crawlers intact), and emit `Cache-Control: no-store, max-age=0` + `Cross-Origin-Resource-Policy` (`same-origin` default) on all error and rate-limit responses.
 * @rationale Centralizing Fetch Metadata, proxy header precedence (`x-vercel-forwarded-for`, rightmost `x-forwarded-for`), and `no-store` error headers prevents security-header drift or cache poisoning across API route handlers.
 * @adr ADR-016, ADR-022, ADR-080, ADR-082
 */

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
 * Determines whether the incoming request arrived over HTTPS (either via the outermost
 * `x-forwarded-proto` proxy header or directly via `request.url`) so cookie writers set
 * `Secure` on HTTPS deployments while preserving plain HTTP `localhost` / `127.0.0.1` testing.
 */
export function isHttpsRequest(
  request: Request | { url?: string; headers: Pick<Headers, 'get'> }
): boolean {
  const forwardedProto = request.headers.get('x-forwarded-proto');
  if (forwardedProto) {
    const primaryProto = forwardedProto.split(',')[0]?.trim().toLowerCase();
    if (primaryProto === 'https') return true;
    if (primaryProto === 'http') return false;
  }

  if (typeof request.url === 'string' && request.url.trim().length > 0) {
    try {
      return new URL(request.url, 'http://localhost').protocol === 'https:';
    } catch {
      return false;
    }
  }

  return false;
}

const BLOCKED_CONTENT_FETCH_DESTS = new Set([
  'document',
  'iframe',
  'frame',
  'embed',
  'object',
  'fencedframe',
]);

/**
 * Evaluates W3C Fetch Metadata headers (`Sec-Fetch-Dest`, `Sec-Fetch-Mode`, `Sec-Fetch-Site`)
 * on `/api/books/content` requests to reject direct browser tab deeplinks, iframe/object
 * embeds, and cross-site subresource hotlinks while leaving first-party `<img>`/`fetch()` calls,
 * `type=card` OpenGraph social images, shared `s-maxage` CDN keys, and headerless bots intact.
 */
export function isBlockedContentAssetRequest(request: {
  url?: string;
  nextUrl?: { searchParams?: Pick<URLSearchParams, 'get'> };
  headers: Pick<Headers, 'get'>;
}): boolean {
  let contentType = '';
  if (typeof request.nextUrl?.searchParams?.get === 'function') {
    contentType = (request.nextUrl.searchParams.get('type') || '').trim().toLowerCase();
  } else if (typeof request.url === 'string' && request.url.trim().length > 0) {
    try {
      const parsedUrl = new URL(request.url, 'http://localhost');
      contentType = (parsedUrl.searchParams.get('type') || '').trim().toLowerCase();
    } catch {
      return false;
    }
  }

  // Social reading card PNGs (`type=card`) explicitly allow cross-origin embedding (`CORP: cross-origin`).
  if (contentType === 'card') {
    return false;
  }

  const dest = (request.headers.get('sec-fetch-dest') || '').trim().toLowerCase();
  const mode = (request.headers.get('sec-fetch-mode') || '').trim().toLowerCase();
  const site = (request.headers.get('sec-fetch-site') || '').trim().toLowerCase();

  // Fail open when Fetch Metadata headers are absent (OpenGraph/SEO crawlers, older clients, Node probes).
  if (!dest && !mode && !site) {
    return false;
  }

  return (
    BLOCKED_CONTENT_FETCH_DESTS.has(dest) ||
    mode === 'navigate' ||
    site === 'cross-site'
  );
}

/**
 * Returns a standardized `403 no-store` `same-origin` response when a `/api/books/content`
 * request triggers Fetch Metadata anti-deeplink or cross-site asset isolation rules, or `null` when allowed.
 */
export function guardContentAssetRequest(request: {
  url?: string;
  nextUrl?: { searchParams?: Pick<URLSearchParams, 'get'> };
  headers: Pick<Headers, 'get'>;
}): NextResponse | null {
  if (!isBlockedContentAssetRequest(request)) {
    return null;
  }
  return createNoStoreErrorResponse(
    'Direct browser deeplinking or cross-site embedding of book assets is not permitted.',
    403
  );
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

