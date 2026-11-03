import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import RootLayout, { metadata, viewport } from './layout';

const mockGetCookie = vi.fn();
const mockGetHeader = vi.fn();

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => mockGetCookie(name),
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
      { url: '/icon.svg?v=2', type: 'image/svg+xml' },
      { url: '/favicon.ico?v=2', sizes: '32x32', type: 'image/x-icon' },
    ]);
    expect(icons.apple).toBe('/icons/apple-touch-icon.png?v=2');
    expect(viewport.viewportFit).toBe('cover');
    expect(viewport.width).toBe('device-width');
  });

  it('should render children within html structure alongside analytics and performance telemetry', async () => {
    const originalError = console.error;
    console.error = (...args: unknown[]) => {
      if (typeof args[0] === 'string' && args[0].includes('cannot be a child of <div>')) {
        return;
      }
      originalError(...args);
    };

    try {
      mockGetCookie.mockReturnValue({ value: 'FR' });
      const layoutJsx = await RootLayout({
        children: <div data-testid="layout-children">Layout App</div>,
      });
      render(layoutJsx);
      expect(screen.getByTestId('layout-children')).toBeInTheDocument();
      expect(screen.getByTestId('vercel-analytics')).toBeInTheDocument();
      expect(screen.getByTestId('vercel-speed-insights')).toBeInTheDocument();
    } finally {
      console.error = originalError;
    }
  });

  it('should render Schema.org @graph JSON-LD script declaring WebSite and universal WebApplication entities', async () => {
    const originalError = console.error;
    console.error = (...args: unknown[]) => {
      if (typeof args[0] === 'string' && args[0].includes('cannot be a child of <div>')) {
        return;
      }
      originalError(...args);
    };

    try {
      mockGetCookie.mockReturnValue(undefined);
      const layoutJsx = await RootLayout({
        children: <div>Test Content</div>,
      });
      render(layoutJsx);
      const script = document.querySelector('script[type="application/ld+json"]');
      expect(script).toBeInTheDocument();
      if (script) {
        const parsed = JSON.parse(script.textContent || '{}');
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
      }
    } finally {
      console.error = originalError;
    }
  });

  it('should gracefully handle cookie exception and fallback to US', async () => {
    const originalError = console.error;
    console.error = (...args: unknown[]) => {
      if (typeof args[0] === 'string' && args[0].includes('cannot be a child of <div>')) {
        return;
      }
      originalError(...args);
    };

    try {
      mockGetCookie.mockImplementationOnce(() => {
        throw new Error('Header context unavailable');
      });
      const layoutJsx = await RootLayout({
        children: <div data-testid="fallback-child">Fallback</div>,
      });
      render(layoutJsx);
      expect(screen.getByTestId('fallback-child')).toBeInTheDocument();
    } finally {
      console.error = originalError;
    }
  });

  it('should fall back to x-vercel-ip-country header on first visit when geo cookie is absent', async () => {
    const originalError = console.error;
    console.error = (...args: unknown[]) => {
      if (typeof args[0] === 'string' && args[0].includes('cannot be a child of <div>')) {
        return;
      }
      originalError(...args);
    };

    try {
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
    } finally {
      mockGetHeader.mockReset();
      console.error = originalError;
    }
  });
});

