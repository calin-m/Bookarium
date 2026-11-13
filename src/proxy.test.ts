import { describe, it, expect, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { proxy, config, GEO_COOKIE_NAME, shouldSkipSessionRefresh } from './proxy';
import * as supabaseMiddleware from '@/lib/supabase/middleware';

describe('Root Proxy (Next.js 16)', () => {
  it('calls updateSession with the incoming request', async () => {
    const mockResponse = NextResponse.next();
    const updateSessionSpy = vi
      .spyOn(supabaseMiddleware, 'updateSession')
      .mockResolvedValueOnce(mockResponse);

    const req = new NextRequest('http://localhost:3000/account');
    const res = await proxy(req);

    expect(updateSessionSpy).toHaveBeenCalledWith(req);
    expect(res).toBe(mockResponse);
  });

  it('gracefully falls back to NextResponse.next when updateSession throws', async () => {
    vi.spyOn(supabaseMiddleware, 'updateSession').mockRejectedValueOnce(
      new Error('Middleware crash')
    );

    const req = new NextRequest('http://localhost:3000/account');
    const res = await proxy(req);

    expect(res).toBeDefined();
    expect(res.status).toBe(200);
  });

  it('exports valid matcher config', () => {
    expect(config.matcher).toBeDefined();
    expect(config.matcher.length).toBeGreaterThan(0);
  });

  it('detects country from x-vercel-ip-country and stamps cookie and header', async () => {
    const req = new NextRequest('http://localhost:3000/catalog', {
      headers: { 'x-vercel-ip-country': 'FR' },
    });
    const res = await proxy(req);

    const geoCookie = res.cookies.get(GEO_COOKIE_NAME);
    expect(geoCookie?.value).toBe('FR');
    expect(res.headers.get('x-bookarium-country')).toBe('FR');
  });

  it('respects development query parameter override ?country=DE', async () => {
    vi.stubEnv('NODE_ENV', 'development');

    const req = new NextRequest('http://localhost:3000/catalog?country=de');
    const res = await proxy(req);

    const geoCookie = res.cookies.get(GEO_COOKIE_NAME);
    expect(geoCookie?.value).toBe('DE');
    expect(res.headers.get('x-bookarium-country')).toBe('DE');

    vi.unstubAllEnvs();
  });

  it('falls back to existing cookie when no IP headers are present in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    const req = new NextRequest('https://bookarium.vercel.app/catalog', {
      headers: {
        cookie: `${GEO_COOKIE_NAME}=GB`,
      },
    });
    const res = await proxy(req);

    const geoCookie = res.cookies.get(GEO_COOKIE_NAME);
    expect(geoCookie?.value).toBe('GB');
    expect(res.headers.get('x-bookarium-country')).toBe('GB');

    vi.unstubAllEnvs();
  });

  it('infers country from system timezone in development when no override or edge header exists', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
      resolvedOptions: () => ({ timeZone: 'Europe/Bucharest' }),
    } as unknown as Intl.DateTimeFormat);

    const req = new NextRequest('http://localhost:3000/catalog');
    const res = await proxy(req);

    const geoCookie = res.cookies.get(GEO_COOKIE_NAME);
    expect(geoCookie?.value).toBe('RO');
    expect(res.headers.get('x-bookarium-country')).toBe('RO');

    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('defaults to US when no geo signals exist in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    const req = new NextRequest('https://bookarium.vercel.app/catalog');
    const res = await proxy(req);

    const geoCookie = res.cookies.get(GEO_COOKIE_NAME);
    expect(geoCookie?.value).toBe('US');
    expect(res.headers.get('x-bookarium-country')).toBe('US');

    vi.unstubAllEnvs();
  });

  it('skips updateSession and Set-Cookie on /api/books* routes to preserve Vercel Edge CDN s-maxage caching', async () => {
    const updateSessionSpy = vi.spyOn(supabaseMiddleware, 'updateSession');

    const req = new NextRequest('https://bookarium.vercel.app/api/books/1342/content', {
      headers: { 'x-vercel-ip-country': 'DE' },
    });
    const res = await proxy(req);

    expect(updateSessionSpy).not.toHaveBeenCalled();
    expect(res.cookies.get(GEO_COOKIE_NAME)).toBeUndefined();
    expect(res.headers.get('set-cookie')).toBeNull();
    expect(res.headers.get('x-bookarium-country')).toBe('DE');
  });

  it('forwards valid ?s= share token into x-bookarium-share-token header and ignores malformed tokens', async () => {
    const validReq = new NextRequest('https://bookarium.vercel.app/read/1342?s=MTpkOjE6NDg6MTI6NjF_f791a453');
    const validRes = await proxy(validReq);
    expect(validRes.headers.get('x-bookarium-share-token')).toBe('MTpkOjE6NDg6MTI6NjF_f791a453');

    const invalidReq = new NextRequest('https://bookarium.vercel.app/read/1342?s=bad!');
    const invalidRes = await proxy(invalidReq);
    expect(invalidRes.headers.get('x-bookarium-share-token')).toBeNull();
  });

  it('skips updateSession for auth callback routes, service worker precache, and background link prefetches', async () => {
    const updateSessionSpy = vi.spyOn(supabaseMiddleware, 'updateSession');
    updateSessionSpy.mockClear();

    const authCallbackReq = new NextRequest('https://bookarium.vercel.app/auth/callback?code=pkce123');
    expect(shouldSkipSessionRefresh(authCallbackReq)).toBe(true);
    await proxy(authCallbackReq);

    const swScriptReq = new NextRequest('https://bookarium.vercel.app/sw.js');
    expect(shouldSkipSessionRefresh(swScriptReq)).toBe(true);

    const manifestReq = new NextRequest('https://bookarium.vercel.app/manifest.webmanifest');
    expect(shouldSkipSessionRefresh(manifestReq)).toBe(true);

    const prefetchReq = new NextRequest('https://bookarium.vercel.app/account', {
      headers: { purpose: 'prefetch' },
    });
    expect(shouldSkipSessionRefresh(prefetchReq)).toBe(true);
    await proxy(prefetchReq);

    const secPrefetchReq = new NextRequest('https://bookarium.vercel.app/account', {
      headers: { 'sec-purpose': 'prefetch;prerender' },
    });
    expect(shouldSkipSessionRefresh(secPrefetchReq)).toBe(true);

    const routerPrefetchReq = new NextRequest('https://bookarium.vercel.app/privacy', {
      headers: { 'next-router-prefetch': '1' },
    });
    expect(shouldSkipSessionRefresh(routerPrefetchReq)).toBe(true);

    const swPrecacheReq = new NextRequest('https://bookarium.vercel.app/account', {
      headers: { 'x-bookarium-sw-precache': '1' },
    });
    expect(shouldSkipSessionRefresh(swPrecacheReq)).toBe(true);
    const swRes = await proxy(swPrecacheReq);
    expect(swRes.cookies.get(GEO_COOKIE_NAME)).toBeUndefined();

    expect(updateSessionSpy).not.toHaveBeenCalled();
  });

  it('skips updateSession on public-route client RSC navigations while preserving full checks on /account and document requests', async () => {
    const updateSessionSpy = vi
      .spyOn(supabaseMiddleware, 'updateSession')
      .mockResolvedValue(NextResponse.next());
    updateSessionSpy.mockClear();

    const homeRscReq = new NextRequest('https://bookarium.vercel.app/', {
      headers: { rsc: '1' },
    });
    expect(shouldSkipSessionRefresh(homeRscReq)).toBe(true);
    await proxy(homeRscReq);

    const bookRscReq = new NextRequest('https://bookarium.vercel.app/book/1342', {
      headers: { rsc: '1' },
    });
    expect(shouldSkipSessionRefresh(bookRscReq)).toBe(true);
    await proxy(bookRscReq);
    expect(updateSessionSpy).not.toHaveBeenCalled();

    const accountRscReq = new NextRequest('https://bookarium.vercel.app/account', {
      headers: { rsc: '1' },
    });
    expect(shouldSkipSessionRefresh(accountRscReq)).toBe(false);

    const accountSubRscReq = new NextRequest('https://bookarium.vercel.app/account/settings', {
      headers: { rsc: '1' },
    });
    expect(shouldSkipSessionRefresh(accountSubRscReq)).toBe(false);

    const homeDocReq = new NextRequest('https://bookarium.vercel.app/');
    expect(shouldSkipSessionRefresh(homeDocReq)).toBe(false);
    await proxy(homeDocReq);
    expect(updateSessionSpy).toHaveBeenCalledTimes(1);

    const apiContentReq = new NextRequest('https://bookarium.vercel.app/api/books/content?id=1342&type=cover');
    const apiRes = await proxy(apiContentReq);
    expect(apiRes.headers.get('x-middleware-override-headers')).toBeNull();
  });
});

