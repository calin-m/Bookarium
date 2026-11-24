import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { NextRequest } from 'next/server';
import { GET } from './route';
import { SITE_CONFIG } from '@/config/site-config';
import { profileCardRateLimiter } from '@/lib/rate-limiter';
import { encodeProfileCardShareToken } from '@/lib/profile-card-export';
import * as profileLayoutUtils from '@/app/u/[username]/profile-layout-utils';

describe('GET /api/profiles/card', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    profileCardRateLimiter.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('enforces profileCardRateLimiter (20/min) and rejects unexpected query parameters with 400 no-store', async () => {
    const unknownRes = await GET(
      new NextRequest('http://localhost:3000/api/profiles/card?username=jane_austen&extra=1')
    );
    expect(unknownRes.status).toBe(400);
    expect(unknownRes.headers.get('Cache-Control')).toBe('no-store, max-age=0');
    expect(unknownRes.headers.get('Cross-Origin-Resource-Policy')).toBe('same-origin');
    expect(unknownRes.headers.get('X-Content-Type-Options')).toBe('nosniff');

    vi.spyOn(profileCardRateLimiter, 'check').mockReturnValueOnce({
      success: false,
      limit: 20,
      remaining: 0,
      resetMs: 30_000,
    });

    const limitedRes = await GET(
      new NextRequest('http://localhost:3000/api/profiles/card?username=jane_austen')
    );
    expect(limitedRes.status).toBe(429);
    expect(limitedRes.headers.get('Retry-After')).toBe('30');
    expect(limitedRes.headers.get('X-RateLimit-Limit')).toBe('20');
    expect(limitedRes.headers.get('Cache-Control')).toBe('no-store, max-age=0');
  });

  it('collapses missing, private, malformed, and unavailable handles uniformly into a neutral PNG card (ADR-033)', async () => {
    const createElementSpy = vi.spyOn(React, 'createElement');

    vi.spyOn(profileLayoutUtils, 'fetchPublicScholarCardPayload')
      .mockResolvedValueOnce({ status: 'private_or_missing' })
      .mockResolvedValueOnce({ status: 'unavailable' });

    const missingHandleRes = await GET(
      new NextRequest('http://localhost:3000/api/profiles/card')
    );
    const privateRes = await GET(
      new NextRequest('http://localhost:3000/api/profiles/card?username=secret_scholar')
    );
    const unavailableRes = await GET(
      new NextRequest('http://localhost:3000/api/profiles/card?username=offline_scholar')
    );

    for (const res of [missingHandleRes, privateRes, unavailableRes]) {
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toContain('image/png');
      expect(res.headers.get('Cache-Control')).toBe(
        'public, max-age=300, s-maxage=300, stale-while-revalidate=3600'
      );
      expect(res.headers.get('Cross-Origin-Resource-Policy')).toBe('cross-origin');
      expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    }

    const emitted = createElementSpy.mock.calls.flatMap((args) => args.slice(2));
    expect(emitted).toContain('BOOKARIUM • SCHOLAR SANCTUARY');
    expect(emitted).toContain('Public Domain Scholar Sanctuary');
    expect(emitted).not.toContain('@secret_scholar');
    expect(emitted).not.toContain('@offline_scholar');
  });

  it('renders a themed 1200x630 PNG scholar card honoring handle-signed ?s= visual flags and ignoring tampered tokens', async () => {
    const createElementSpy = vi.spyOn(React, 'createElement');

    vi.spyOn(profileLayoutUtils, 'fetchPublicScholarCardPayload').mockResolvedValue({
      status: 'public',
      card: {
        username: 'jane_austen',
        displayName: 'Jane Austen',
        initials: 'JA',
        memberSince: 'June 2025',
        bio: 'Vanity and pride are different things.',
        bioBookTitle: 'Pride and Prejudice',
        bioBookAuthor: 'Jane Austen',
        statsPills: ['14d Streak', '10/25 Goal'],
      },
    });

    // 1. Valid handle-bound dark theme + includeStats=false token
    const validToken = encodeProfileCardShareToken({
      username: 'jane_austen',
      theme: 'dark',
      includeStats: false,
    });
    const darkNoStatsRes = await GET(
      new NextRequest(`http://localhost:3000/api/profiles/card?username=jane_austen&s=${validToken}`)
    );

    expect(darkNoStatsRes.status).toBe(200);
    expect(darkNoStatsRes.headers.get('Content-Type')).toContain('image/png');
    expect(darkNoStatsRes.headers.get('Cache-Control')).toBe(
      'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800'
    );
    expect(darkNoStatsRes.headers.get('Cross-Origin-Resource-Policy')).toBe('cross-origin');

    const darkChildren = createElementSpy.mock.calls.flatMap((args) => args.slice(2));
    expect(darkChildren).toContain('Jane Austen');
    expect(darkChildren).toContain('@jane_austen');
    expect(darkChildren).toContain('SCHOLAR SINCE JUNE 2025');
    expect(darkChildren).toContain('— Pride and Prejudice, Jane Austen');
    expect(darkChildren).toContain(`${SITE_CONFIG.SITE_HOST}/u/jane_austen`);
    expect(darkChildren).not.toContain('14d Streak');

    // Verify dark surface color was applied on root card element
    const darkSurfaceApplied = createElementSpy.mock.calls.some(
      (args) => (args[1] as { style?: { backgroundColor?: string } } | null)?.style?.backgroundColor === '#181816'
    );
    expect(darkSurfaceApplied).toBe(true);

    // 2. Cross-handle / tampered token safely falls back to light palette & default server stats
    createElementSpy.mockClear();
    const replayedToken = encodeProfileCardShareToken({
      username: 'another_user',
      theme: 'dark',
      includeStats: false,
    });
    const fallbackRes = await GET(
      new NextRequest(
        `http://localhost:3000/api/profiles/card?username=jane_austen&s=${replayedToken}`
      )
    );
    expect(fallbackRes.status).toBe(200);
    const lightSurfaceApplied = createElementSpy.mock.calls.some(
      (args) => (args[1] as { style?: { backgroundColor?: string } } | null)?.style?.backgroundColor === '#fdfbf7'
    );
    expect(lightSurfaceApplied).toBe(true);
    const fallbackChildren = createElementSpy.mock.calls.flatMap((args) => args.slice(2));
    expect(fallbackChildren).toContain('14d Streak');
    expect(fallbackChildren).toContain('10/25 Goal');
  });
});
