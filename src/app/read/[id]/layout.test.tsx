import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { headers } from 'next/headers';
import BookReaderLayout, {
  generateMetadata,
  clearServerMetadataCache,
  isClientSideNavigation,
} from './layout';

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

describe('BookReaderLayout and generateMetadata', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearServerMetadataCache();
    vi.mocked(headers).mockResolvedValue(new Headers());
  });

  it('generates rich metadata for a curated hero classic (Frankenstein #84)', async () => {
    const meta = await generateMetadata({
      params: Promise.resolve({ id: '84' }),
    });

    expect(meta.title).toContain('Frankenstein');
    expect(meta.title).toContain('Mary Wollstonecraft Shelley');
    expect(meta.description).toContain('Frankenstein');
    const og = meta.openGraph as Record<string, unknown> | undefined;
    const tw = meta.twitter as Record<string, unknown> | undefined;
    expect(og?.type).toBe('book');
    expect(tw?.card).toBe('summary_large_image');
    expect(meta.alternates?.canonical).toBe('/read/84');
  });

  it('provides safe fallback metadata for invalid book ID', async () => {
    const meta = await generateMetadata({
      params: Promise.resolve({ id: 'invalid-id' }),
    });

    expect(meta.title).toBe('Book Reader');
    expect(meta.description).toBeDefined();
  });

  it('bypasses outbound network calls on client-side router navigation (rsc: 1 fast-path)', async () => {
    vi.mocked(headers).mockResolvedValue(new Headers({ rsc: '1' }));
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const meta = await generateMetadata({
      params: Promise.resolve({ id: '77777' }),
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(meta.title).toContain('Gutenberg Volume #77777');
    expect(meta.alternates?.canonical).toBe('/read/77777');

    const layoutJsx = await BookReaderLayout({
      params: Promise.resolve({ id: '77777' }),
      children: <div data-testid="client-nav-child">Instant Reader Content</div>,
    });

    render(layoutJsx);
    expect(screen.getByTestId('client-nav-child')).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('detects client-side navigation correctly from various Next.js headers', async () => {
    vi.mocked(headers).mockResolvedValueOnce(new Headers({ 'next-router-state-tree': 'true' }));
    expect(await isClientSideNavigation()).toBe(true);

    vi.mocked(headers).mockResolvedValueOnce(new Headers({ 'next-router-prefetch': '1' }));
    expect(await isClientSideNavigation()).toBe(true);

    vi.mocked(headers).mockResolvedValueOnce(new Headers({ accept: 'text/x-component' }));
    expect(await isClientSideNavigation()).toBe(true);

    vi.mocked(headers).mockResolvedValueOnce(new Headers({ accept: 'text/html' }));
    expect(await isClientSideNavigation()).toBe(false);
  });

  it('serves repeated requests from in-memory server cache without network calls', async () => {
    const mockBook = {
      id: 55555,
      title: 'Cached Wonder',
      authors: [{ name: 'Cache Master', birth_year: null, death_year: null }],
      translators: [],
      subjects: ['Fiction'],
      bookshelves: [],
      languages: ['en'],
      copyright: false,
      media_type: 'Text',
      formats: { 'image/jpeg': 'https://example.com/cached.jpg' },
      download_count: 100,
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [mockBook] }),
    } as Response);

    // Initial direct navigation (e.g. crawler) fetches from network
    const meta1 = await generateMetadata({
      params: Promise.resolve({ id: '55555' }),
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(meta1.title).toContain('Cached Wonder');

    // Subsequent navigation uses server memory cache even if client navigation flag is absent
    const meta2 = await generateMetadata({
      params: Promise.resolve({ id: '55555' }),
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(meta2.title).toContain('Cached Wonder');
  });

  it('renders children and Schema.org Book JSON-LD script', async () => {
    const layoutJsx = await BookReaderLayout({
      params: Promise.resolve({ id: '84' }),
      children: <div data-testid="reader-child">Reader Content</div>,
    });

    render(layoutJsx);

    expect(screen.getByTestId('reader-child')).toBeInTheDocument();

    const script = document.querySelector('script[type="application/ld+json"]');
    expect(script).toBeInTheDocument();
    if (script) {
      const parsed = JSON.parse(script.textContent || '{}');
      expect(parsed['@type']).toBe('Book');
      expect(parsed.name).toContain('Frankenstein');
      expect(parsed.author?.name).toContain('Shelley');
    }
  });

  it('falls back gracefully when upstream fetch times out or fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new DOMException('The operation was aborted.', 'AbortError'));

    const meta = await generateMetadata({
      params: Promise.resolve({ id: '999999' }),
    });

    expect(meta.title).toBeDefined();
    expect(meta.description).toBeDefined();

    const layoutJsx = await BookReaderLayout({
      params: Promise.resolve({ id: '999999' }),
      children: <div data-testid="fallback-child">Fallback Content</div>,
    });

    render(layoutJsx);
    expect(screen.getByTestId('fallback-child')).toBeInTheDocument();
  });
});


