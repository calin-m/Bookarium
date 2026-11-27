/**
 * @module src/app/covers/[file]/route
 * @scope Crawler-accessible, same-origin JPEG cover route (`/covers/<id>.jpg`) streaming R2 artwork outside `/api/*` while enforcing browser anti-deeplink & hotlink Fetch Metadata isolation.
 * @invariant Enforce `guardContentAssetRequest(request)` (`403 no-store` on browser tab `navigate`/`document` deeplinks and `cross-site` subresource hotlinks while permitting headerless SEO crawlers and same-origin `<img>` requests), validate strict `<id>.jpg` digits, enforce `bookCoverRateLimiter`, reject unexpected query params, and serve `30d` CDN-cached JPEGs strictly from private R2 (`404 no-store` on miss/unconfigured).
 * @rationale Separating clean `.jpg` URLs from `/api/*` enables Googlebot-Image & social crawlers to fetch verified book covers under `robots.ts` while keeping raw plain-text books and third-party browser hotlinking blocked.
 * @adr ADR-016, ADR-080, ADR-082
 */

import { NextRequest } from 'next/server';
import { bookCoverRateLimiter } from '@/lib/rate-limiter';
import {
  buildApiSecurityHeaders,
  createNoStoreErrorResponse,
  createRateLimitErrorResponse,
  getClientIp,
  guardContentAssetRequest,
  hasUnexpectedQueryParams,
} from '@/lib/api-utils';
import {
  CONTENT_COVER_CACHE_CONTROL,
  fetchR2CoverAssetResponse,
} from '@/app/api/books/content/asset-renders';

const ALLOWED_COVER_QUERY_KEYS = new Set<string>();
const DEV_ONLY_COVER_QUERY_KEYS = new Set(['country']);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ file: string }> }
) {
  const blockedAssetResponse = guardContentAssetRequest(request);
  if (blockedAssetResponse) {
    return blockedAssetResponse;
  }

  const clientIp = getClientIp(request);
  const rateLimit = bookCoverRateLimiter.check(clientIp);
  if (!rateLimit.success) {
    return createRateLimitErrorResponse(rateLimit);
  }

  const { searchParams } = new URL(request.url);
  if (
    hasUnexpectedQueryParams(
      searchParams,
      ALLOWED_COVER_QUERY_KEYS,
      DEV_ONLY_COVER_QUERY_KEYS
    )
  ) {
    return createNoStoreErrorResponse('Unsupported or disallowed query parameter.', 400);
  }

  const { file } = await params;
  const match = file.match(/^(\d{1,8})\.jpg$/i);
  const bookId = match ? parseInt(match[1], 10) : NaN;
  if (!Number.isInteger(bookId) || bookId <= 0 || bookId > 10000000) {
    return createNoStoreErrorResponse('Missing or invalid Project Gutenberg book ID.', 400);
  }

  return fetchR2CoverAssetResponse(bookId, () => ({
    'Content-Type': 'image/jpeg',
    'Cache-Control': CONTENT_COVER_CACHE_CONTROL,
    Vary: 'Accept-Encoding',
    'Vercel-Cache-Tag': 'covers',
    'X-Bookarium-Source': 'r2',
    ...buildApiSecurityHeaders('same-origin'),
  }));
}
