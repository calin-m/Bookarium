import { describe, it, expect, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { proxy, config, GEO_COOKIE_NAME } from './proxy';
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

  it('falls back to existing cookie when no IP headers are present', async () => {
    const req = new NextRequest('http://localhost:3000/catalog', {
      headers: {
        cookie: `${GEO_COOKIE_NAME}=GB`,
      },
    });
    const res = await proxy(req);

    const geoCookie = res.cookies.get(GEO_COOKIE_NAME);
    expect(geoCookie?.value).toBe('GB');
    expect(res.headers.get('x-bookarium-country')).toBe('GB');
  });

  it('defaults to US when no geo signals exist', async () => {
    const req = new NextRequest('http://localhost:3000/catalog');
    const res = await proxy(req);

    const geoCookie = res.cookies.get(GEO_COOKIE_NAME);
    expect(geoCookie?.value).toBe('US');
    expect(res.headers.get('x-bookarium-country')).toBe('US');
  });
});

