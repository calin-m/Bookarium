import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import RootLayout, { metadata, viewport } from './layout';
import { resolveGoogleSiteVerification } from '@/config/site-config';

const mockGetCookie = vi.fn();
const mockGetAllCookies = vi.fn(() => [] as Array<{ name: string; value: string }>);
const mockGetHeader = vi.fn();

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => mockGetCookie(name),
    getAll: () => mockGetAllCookies(),
  })),
  headers: vi.fn(async () => ({
    get: (name: string) => mockGetHeader(name),
  })),
}));

vi.mock('@vercel/analytics/react', () => ({
  Analytics: () => <div data-testid="vercel-analytics" />,
}));

vi.mock('@vercel/speed-insights/next', () => ({
  SpeedInsights: () => <div data-testid="vercel-speed-insights" />,
}));

describe('RootLayout', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      const message = args.map(String).join(' ');
      if (message.includes('cannot be a child of') || message.includes('hydration error')) {
        return;
      }
      console.warn(...args);
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('should expose valid metadata with OpenGraph, Twitter, and canonical alternates', () => {
    const titleObj = metadata.title as { default: string; template: string };
    expect(titleObj.default).toContain('Bookarium');
    expect(metadata.description).toBeDefined();
    expect(metadata.metadataBase).toBeDefined();
    expect(metadata.alternates?.canonical).toBe('/');
    const og = metadata.openGraph as Record<string, unknown> | undefined;
    const tw = metadata.twitter as Record<string, unknown> | undefined;
    expect(og?.type).toBe('website');
    expect(og?.images).toBeDefined();
    expect(tw?.card).toBe('summary');
    expect(metadata.icons).toBeDefined();
    const icons = metadata.icons as { icon: Array<{ url: string }>; apple: string };
    expect(icons.icon).toEqual([
      { url: '/icon.svg?v=4', type: 'image/svg+xml' },
      { url: '/favicon.ico?v=4', sizes: '32x32', type: 'image/x-icon' },
    ]);
    expect(icons.apple).toBe('/icons/apple-touch-icon.png?v=4');
    expect(viewport.viewportFit).toBe('cover');
    expect(viewport.width).toBe('device-width');

    expect(resolveGoogleSiteVerification('  gsc-token-xyz  ')).toEqual({
      google: 'gsc-token-xyz',
    });
    expect(resolveGoogleSiteVerification('')).toBeUndefined();
  });

  it('should render children within html structure alongside analytics and performance telemetry', async () => {
    mockGetCookie.mockReturnValue({ value: 'FR' });
    const layoutJsx = await RootLayout({
      children: <div data-testid="layout-children">Layout App</div>,
    });
    render(layoutJsx);
    expect(screen.getByTestId('layout-children')).toBeInTheDocument();
    expect(screen.getByTestId('vercel-analytics')).toBeInTheDocument();
    expect(screen.getByTestId('vercel-speed-insights')).toBeInTheDocument();
  });

  it('should render Schema.org @graph JSON-LD script declaring WebSite and universal WebApplication entities', async () => {
    mockGetCookie.mockReturnValue(undefined);
    const layoutJsx = await RootLayout({
      children: <div>Test Content</div>,
    });
    render(layoutJsx);
    const script = document.querySelector('script[type="application/ld+json"]');
    expect(script).toBeInTheDocument();
    const parsed = JSON.parse(script!.textContent || '{}');
    expect(parsed['@context']).toBe('https://schema.org');
    expect(Array.isArray(parsed['@graph'])).toBe(true);
    const website = parsed['@graph'].find((e: Record<string, unknown>) => e['@type'] === 'WebSite');
    const webApp = parsed['@graph'].find((e: Record<string, unknown>) => e['@type'] === 'WebApplication');
    expect(website).toBeDefined();
    expect(website.potentialAction).toBeDefined();
    expect(webApp).toBeDefined();
    expect(webApp.isAccessibleForFree).toBe(true);
    expect(webApp.applicationCategory).toBe('BooksApplication');
    expect(webApp.license).toBe('https://opensource.org/licenses/MIT');
  });

  it('should gracefully handle cookie exception and fallback to US', async () => {
    mockGetCookie.mockImplementationOnce(() => {
      throw new Error('Header context unavailable');
    });
    const layoutJsx = await RootLayout({
      children: <div data-testid="fallback-child">Fallback</div>,
    });
    render(layoutJsx);
    expect(screen.getByTestId('fallback-child')).toBeInTheDocument();
  });

  it('should fall back to x-vercel-ip-country header on first visit when geo cookie is absent', async () => {
    mockGetCookie.mockReturnValue(undefined);
    mockGetHeader.mockImplementation((name: string) =>
      name === 'x-vercel-ip-country' ? 'DE' : null
    );
    const layoutJsx = await RootLayout({
      children: <div data-testid="header-geo-child">Header Geo</div>,
    });
    render(layoutJsx);
    expect(screen.getByTestId('header-geo-child')).toBeInTheDocument();
    expect(mockGetHeader).toHaveBeenCalledWith('x-vercel-ip-country');
    mockGetHeader.mockReset();
  });

  it('should detect chunked Supabase OAuth session cookies (sb-*-auth-token.0) for SSR auth hint', async () => {
    mockGetCookie.mockReturnValue(undefined);
    mockGetAllCookies.mockReturnValueOnce([
      { name: 'sb-project-auth-token.0', value: 'chunk-0' },
      { name: 'sb-project-auth-token.1', value: 'chunk-1' },
    ]);
    const layoutJsx = await RootLayout({
      children: <div data-testid="chunked-oauth-child">Chunked OAuth</div>,
    });
    render(layoutJsx);
    expect(screen.getByTestId('chunked-oauth-child')).toBeInTheDocument();
    expect(mockGetAllCookies).toHaveBeenCalled();
  });
});

