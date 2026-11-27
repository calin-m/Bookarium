import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  CONTENT_COVER_CACHE_CONTROL,
  CONTENT_CARD_CACHE_CONTROL,
  enforceBookAssetJurisdictionGate,
  renderBookCardAssetResponse,
  fetchR2CoverAssetResponse,
} from './asset-renders';
import * as metadataCache from './metadata-cache';
import * as r2Client from '@/lib/r2-client';

describe('asset-renders shared cover and OpenGraph card helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('exports 30d cover and 24h card CDN cache directives', () => {
    expect(CONTENT_COVER_CACHE_CONTROL).toBe(
      'public, max-age=2592000, s-maxage=2592000, stale-while-revalidate=2592000'
    );
    expect(CONTENT_CARD_CACHE_CONTROL).toBe(
      'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800'
    );
  });

  it('enforces HTTP 451 and non-US 503 fail-closed jurisdiction gates cleanly', async () => {
    vi.spyOn(metadataCache, 'resolveBookMetadata').mockResolvedValueOnce(null);
    const unavailableReq = new NextRequest('http://localhost:3000/og/books/1342.png', {
      headers: { 'x-vercel-ip-country': 'DE' },
    });
    const gate503 = await enforceBookAssetJurisdictionGate(
      1342,
      unavailableReq,
      unavailableReq.nextUrl.searchParams
    );
    expect(gate503.allowed).toBe(false);
    if (!gate503.allowed) {
      expect(gate503.response.status).toBe(503);
    }

    vi.spyOn(metadataCache, 'resolveBookMetadata').mockResolvedValueOnce({
      id: 9001,
      title: 'Restricted Work',
      authors: [{ name: 'Author, Modern', birth_year: 1940, death_year: 2010 }],
      copyright: true,
    });
    const restrictedReq = new NextRequest('http://localhost:3000/og/books/9001.png', {
      headers: { 'x-vercel-ip-country': 'US' },
    });
    const gate451 = await enforceBookAssetJurisdictionGate(
      9001,
      restrictedReq,
      restrictedReq.nextUrl.searchParams
    );
    expect(gate451.allowed).toBe(false);
    if (!gate451.allowed) {
      expect(gate451.response.status).toBe(451);
      expect(gate451.response.headers.get('Cross-Origin-Resource-Policy')).toBe('same-origin');
    }
  });

  it('renders 1200x630 PNG cards with CORP cross-origin and maps R2 cover states accurately', async () => {
    const cardRes = renderBookCardAssetResponse({
      bookId: 1342,
      metadata: {
        id: 1342,
        title: 'Pride and Prejudice',
        authors: [{ name: 'Austen, Jane', birth_year: 1775, death_year: 1817 }],
        copyright: false,
      },
      shareToken: null,
    });
    expect(cardRes.headers.get('Cache-Control')).toBe(CONTENT_CARD_CACHE_CONTROL);
    expect(cardRes.headers.get('Cross-Origin-Resource-Policy')).toBe('cross-origin');

    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    vi.spyOn(r2Client, 'fetchR2CoverBytes')
      .mockResolvedValueOnce({
        status: 'ok',
        bytes: jpegBytes.buffer,
        contentType: 'image/jpeg',
      })
      .mockResolvedValueOnce({ status: 'not_found' })
      .mockResolvedValueOnce({ status: 'error' })
      .mockRejectedValueOnce(new Error('R2 abort'));

    const okRes = await fetchR2CoverAssetResponse(1342, () => ({
      'Content-Type': 'image/jpeg',
      'Cache-Control': CONTENT_COVER_CACHE_CONTROL,
    }));
    expect(okRes.status).toBe(200);
    expect(okRes.headers.get('Cache-Control')).toBe(CONTENT_COVER_CACHE_CONTROL);

    const missRes = await fetchR2CoverAssetResponse(1342, () => ({}));
    expect(missRes.status).toBe(404);

    const errRes = await fetchR2CoverAssetResponse(1342, () => ({}));
    expect(errRes.status).toBe(502);

    const rejectRes = await fetchR2CoverAssetResponse(1342, () => ({}));
    expect(rejectRes.status).toBe(502);
  });
});
