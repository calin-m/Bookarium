/**
 * @module src/app/api/books/content/route
 * @scope Multi-purpose book asset endpoint streaming plain-text volumes (`type=''`), R2-backed cover JPEGs (`type=cover`), and stateless `1200x630` OpenGraph reading cards (`type=card`).
 * @invariant Reject disallowed query params (`ALLOWED_CONTENT_QUERY_KEYS`, allowing `s` exclusively with `type=card` and rejecting `?url=` upstream proxies with `400 no-store`), enforce defense-in-depth Fetch Metadata anti-deeplink & cross-site isolation (`guardContentAssetRequest` returning `403 no-store` outside `type=card` and headerless crawlers), enforce mode-scoped rate limiters, reject HTTP `200` `text/html` outage/interstitial pages (`isHtmlPayload`), and bound payloads (`MAX_R2_BOOK_BYTES` text / `MAX_R2_COVER_BYTES` cover).
 * @invariant Enforce `HTTP 451` gatekeeping whenever resolved metadata restricts a volume in the caller's jurisdiction (including US `copyright === true` blocks) on plain-text and `type=card` requests, fail closed with `503` for non-US requests when metadata is unavailable, and bypass `resolveBookMetadata` for `type=cover` requests; emit `Cross-Origin-Resource-Policy: cross-origin` exclusively for `200` `type=card` PNGs.
 * @invariant Serve `type=cover` and plain text strictly from private Cloudflare R2 (`404` on R2 miss, `503` when R2 is unconfigured for plain text / `404` for covers, zero Project Gutenberg or external mirror fallback), coalesce concurrent upstream R2 fetches per `bookId` inside `inFlightR2Fetches`, cache resolved text in `bookContentLruCache`, and attach `Vercel-Cache-Tag` (`covers` on `200` cover responses, `book-content` on `200` plain-text responses) while keeping `no-store` errors untagged.
 * @rationale Keeping R2 credentials server-only eliminates browser/runtime Project Gutenberg requests and external cover hotlinking completely, ensuring 100% ToS compliance while preserving IndexedDB offline reading and optional Supabase `books.content` reads.
 * @adr ADR-016, ADR-022, ADR-039, ADR-080, ADR-082, ADR-084
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  bookContentRateLimiter,
  bookCardRateLimiter,
  bookCoverRateLimiter,
} from '@/lib/rate-limiter';
import {
  getClientIp,
  createRateLimitErrorResponse,
  buildApiSecurityHeaders,
  hasUnexpectedQueryParams,
  createNoStoreErrorResponse,
  guardContentAssetRequest,
} from '@/lib/api-utils';
import {
  fetchR2BookText,
  type R2BookTextFetchResult,
} from '@/lib/r2-client';

import {
  getCachedBookContent,
  setCachedBookContent,
} from './metadata-cache';
import {
  enforceBookAssetJurisdictionGate,
  renderBookCardAssetResponse,
  fetchR2CoverAssetResponse,
} from './asset-renders';
import { isSupabaseConfigured } from '@/lib/catalog/supabase-provider';
import { createClient } from '@/lib/supabase/client';

const ALLOWED_CONTENT_QUERY_KEYS = new Set(['id', 'type', 's']);
const DEV_ONLY_CONTENT_QUERY_KEYS = new Set(['country']);
const SUPPORTED_CONTENT_TYPES = new Set(['', 'cover', 'card']);
const inFlightR2Fetches = new Map<number, Promise<R2BookTextFetchResult>>();

export async function GET(request: NextRequest) {
  const blockedAssetResponse = guardContentAssetRequest(request);
  if (blockedAssetResponse) {
    return blockedAssetResponse;
  }

  const clientIp = getClientIp(request);
  const { searchParams } = new URL(request.url);
  const typeParam = (searchParams.get('type') || '').trim();

  const activeRateLimiter =
    typeParam === 'card'
      ? bookCardRateLimiter
      : typeParam === 'cover'
      ? bookCoverRateLimiter
      : bookContentRateLimiter;

  const rateLimit = activeRateLimiter.check(clientIp);
  if (!rateLimit.success) {
    return createRateLimitErrorResponse(rateLimit);
  }

  if (
    hasUnexpectedQueryParams(
      searchParams,
      ALLOWED_CONTENT_QUERY_KEYS,
      DEV_ONLY_CONTENT_QUERY_KEYS
    )
  ) {
    return createNoStoreErrorResponse('Unsupported or disallowed query parameter.', 400);
  }

  if (!SUPPORTED_CONTENT_TYPES.has(typeParam)) {
    return createNoStoreErrorResponse('Unsupported content "type" parameter.', 400);
  }

  if (searchParams.has('s') && typeParam !== 'card') {
    return createNoStoreErrorResponse('Share token "s" is only permitted with type=card.', 400);
  }

  const idParam = searchParams.get('id') || '';

  if (!idParam) {
    return createNoStoreErrorResponse('Missing "id" parameter.', 400);
  }

  // Strictly extract numeric digits, convert to integer primitive to break string taint flow
  const rawId = idParam.match(/^(\d{1,8})$/)?.[1] || '';

  const bookId = parseInt(rawId, 10);
  if (!Number.isInteger(bookId) || bookId <= 0 || bookId > 10000000) {
    return createNoStoreErrorResponse('Missing or invalid Project Gutenberg book ID.', 400);
  }

  // Extract user jurisdiction through deterministic priority cascade
  // Jurisdictional Copyright Gatekeeper:
  // Verify public domain status across US (`copyright === true` -> 451) and international jurisdictions (`503` fail-closed when metadata unavailable), while bypassing metadata lookups on `type=cover`.
  let resolvedMetadata = null;
  if (typeParam !== 'cover') {
    const gate = await enforceBookAssetJurisdictionGate(bookId, request, searchParams);
    if (!gate.allowed) {
      return gate.response;
    }
    resolvedMetadata = gate.metadata;
  }

  // ==========================================================================
  // Stateless On-the-Fly OpenGraph Social Reading Card (1200x630 PNG)
  // ==========================================================================
  if (typeParam === 'card') {
    return renderBookCardAssetResponse({
      bookId,
      metadata: resolvedMetadata,
      shareToken: searchParams.get('s'),
    });
  }

  // ==========================================================================
  // Binary Cover Image Streaming (Strict Private Cloudflare R2 Storage)
  // ==========================================================================
  if (typeParam === 'cover') {
    return fetchR2CoverAssetResponse(bookId, () => ({
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=2592000, s-maxage=2592000, stale-while-revalidate=2592000',
      Vary: 'Accept-Encoding',
      'Vercel-Cache-Tag': 'covers',
      'X-Bookarium-Source': 'r2',
      ...buildApiSecurityHeaders('same-origin'),
    }));
  }

  // ==========================================================================
  // Tier 0: Server-Side In-Memory LRU Cache (Cross-Jurisdiction Warm Hit)
  // ==========================================================================
  const cachedBook = getCachedBookContent(bookId);
  if (cachedBook) {
    const responseHeaders: Record<string, string> = {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
      'Vary': 'x-vercel-ip-country, Accept-Encoding',
      'Vercel-Cache-Tag': 'book-content',
      ...buildApiSecurityHeaders('same-origin'),
    };
    if (cachedBook.source === 'supabase' || cachedBook.source === 'r2') {
      responseHeaders['X-Bookarium-Source'] = cachedBook.source;
    }
    return new NextResponse(cachedBook.text, {
      status: 200,
      headers: responseHeaders,
    });
  }

  // ==========================================================================
  // Tier 1: Instant Streaming from Dedicated Supabase PostgreSQL Catalog
  // ==========================================================================
  if (isSupabaseConfigured()) {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('books')
        .select('content')
        .eq('id', bookId)
        .abortSignal(AbortSignal.timeout(2500))
        .maybeSingle();

      if (!error && data?.content && data.content.trim().length > 0) {
        setCachedBookContent(bookId, data.content, 'supabase');
        return new NextResponse(data.content, {
          status: 200,
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
            'Vary': 'x-vercel-ip-country, Accept-Encoding',
            'Vercel-Cache-Tag': 'book-content',
            'X-Bookarium-Source': 'supabase',
            ...buildApiSecurityHeaders('same-origin'),
          },
        });
      }
    } catch {
      // Degrade gracefully to Tier 1.5 / Tier 2 content source
    }
  }

  // ==========================================================================
  // Tier 2: Strict Private Cloudflare R2 Storage (books/<id>.txt.gz)
  // ==========================================================================
  let r2Promise = inFlightR2Fetches.get(bookId);
  if (!r2Promise) {
    r2Promise = fetchR2BookText(bookId).finally(() => {
      inFlightR2Fetches.delete(bookId);
    });
    inFlightR2Fetches.set(bookId, r2Promise);
  }

  const r2Result = await r2Promise;

  if (r2Result.status === 'unconfigured') {
    return createNoStoreErrorResponse(
      'Cloudflare R2 asset storage is not configured for this environment. Open an offline-saved volume or configure R2_* credentials.',
      503
    );
  }

  if (r2Result.status === 'not_found') {
    return createNoStoreErrorResponse(
      'Book text is not available in R2 asset storage.',
      404
    );
  }

  if (r2Result.status !== 'ok' || !r2Result.text) {
    return createNoStoreErrorResponse(
      'Failed to fetch unabridged text from R2 asset storage.',
      502
    );
  }

  setCachedBookContent(bookId, r2Result.text, 'r2');

  return new NextResponse(r2Result.text, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
      'Vary': 'x-vercel-ip-country, Accept-Encoding',
      'Vercel-Cache-Tag': 'book-content',
      'X-Bookarium-Source': 'r2',
      ...buildApiSecurityHeaders('same-origin'),
    },
  });
}
