/**
 * @module src/app/og/books/[file]/route
 * @scope Crawler-accessible stateless `1200x630` OpenGraph reading card endpoint (`/og/books/<id>.png`) operating outside `/api/*` for social unfurlers and fallback `Book.image` structured data.
 * @invariant Validate `<id>.png` pattern strictly, allow exclusively signed share tokens (`?s=`), enforce `bookCardRateLimiter`, apply unified US + non-US `HTTP 451` / `503` jurisdiction gatekeeping (`enforceBookAssetJurisdictionGate`), and emit `Cross-Origin-Resource-Policy: cross-origin` with `24h` CDN caching.
 * @rationale Exposing clean `.png` OpenGraph card URLs outside `/api/*` satisfies `robots.txt` while guaranteeing zero `404` schema/social images even for volumes without R2 cover art.
 * @adr ADR-016, ADR-036, ADR-080
 */

import { NextRequest } from 'next/server';
import { bookCardRateLimiter } from '@/lib/rate-limiter';
import {
  createNoStoreErrorResponse,
  createRateLimitErrorResponse,
  getClientIp,
  hasUnexpectedQueryParams,
} from '@/lib/api-utils';
import {
  enforceBookAssetJurisdictionGate,
  renderBookCardAssetResponse,
} from '@/app/api/books/content/asset-renders';

const ALLOWED_OG_CARD_QUERY_KEYS = new Set(['s']);
const DEV_ONLY_OG_CARD_QUERY_KEYS = new Set(['country']);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ file: string }> }
) {
  const clientIp = getClientIp(request);
  const rateLimit = bookCardRateLimiter.check(clientIp);
  if (!rateLimit.success) {
    return createRateLimitErrorResponse(rateLimit);
  }

  const { searchParams } = new URL(request.url);
  if (
    hasUnexpectedQueryParams(
      searchParams,
      ALLOWED_OG_CARD_QUERY_KEYS,
      DEV_ONLY_OG_CARD_QUERY_KEYS
    )
  ) {
    return createNoStoreErrorResponse('Unsupported or disallowed query parameter.', 400);
  }

  const { file } = await params;
  const match = file.match(/^(\d{1,8})\.png$/i);
  const bookId = match ? parseInt(match[1], 10) : NaN;
  if (!Number.isInteger(bookId) || bookId <= 0 || bookId > 10000000) {
    return createNoStoreErrorResponse('Missing or invalid Project Gutenberg book ID.', 400);
  }

  const gate = await enforceBookAssetJurisdictionGate(bookId, request, searchParams);
  if (!gate.allowed) {
    return gate.response;
  }

  return renderBookCardAssetResponse({
    bookId,
    metadata: gate.metadata,
    shareToken: searchParams.get('s'),
  });
}
