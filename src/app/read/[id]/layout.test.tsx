import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { headers } from 'next/headers';
import BookReaderLayout, { generateMetadata } from './layout';
import {
  clearServerMetadataCache,
  isClientSideNavigation,
} from './reader-layout-utils';
import { encodeReadingCardShareToken } from '@/lib/reading-card-export';

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

    const titleObj = meta.title as { absolute: string };
    expect(titleObj.absolute).toBe(
      'Bookarium | Reader | Frankenstein — Mary Wollstonecraft Shelley'
    );
    expect(meta.description).toContain('Frankenstein');
    const og = meta.openGraph as Record<string, unknown> | undefined;
    const tw = meta.twitter as Record<string, unknown> | undefined;
    expect(og?.type).toBe('book');
    expect(og?.title).toBe(titleObj.absolute);
    expect(tw?.card).toBe('summary_large_image');
    expect(tw?.title).toBe(titleObj.absolute);
    expect(meta.alternates?.canonical).toBe('/read/84');
    const ogImages = og?.images as Array<{ url: string }> | undefined;
    expect(ogImages?.[0]?.url).toContain('/api/books/content?id=84&type=card');
  });

  it('attaches verified ?s= share token to OpenGraph and Twitter card image URLs when x-bookarium-share-token is valid', async () => {
    const signedToken = encodeReadingCardShareToken({
      bookId: 84,
      title: 'Frankenstein',
      author: 'Mary Wollstonecraft Shelley',
      theme: 'sepia',
      includeProgress: true,
      progress: 52,
      currentSection: 8,
      totalSections: 24,
    });

    vi.mocked(headers).mockResolvedValue(
      new Headers({ 'x-bookarium-share-token': signedToken })
    );

    const meta = await generateMetadata({
      params: Promise.resolve({ id: '84' }),
    });

    const og = meta.openGraph as Record<string, unknown> | undefined;
    const tw = meta.twitter as Record<string, unknown> | undefined;
    const ogImages = og?.images as Array<{ url: string }> | undefined;
    const twImages = tw?.images as string[] | undefined;

    expect(ogImages?.[0]?.url).toContain(`/api/books/content?id=84&type=card&s=${signedToken}`);
    expect(twImages?.[0]).toContain(`/api/books/content?id=84&type=card&s=${signedToken}`);
  });

  it('provides safe noindex fallback metadata for invalid book ID', async () => {
    const meta = await generateMetadata({
      params: Promise.resolve({ id: 'invalid-id' }),
    });

    expect(meta.title).toEqual({ absolute: 'Bookarium | Reader' });
    expect(meta.description).toBeDefined();
    expect(meta.robots).toEqual({ index: false, follow: false });
  });

  it('bypasses outbound network calls on client-side router navigation (rsc: 1 fast-path)', async () => {
    vi.mocked(headers).mockResolvedValue(new Headers({ rsc: '1' }));
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const meta = await generateMetadata({
      params: Promise.resolve({ id: '77777' }),
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect((meta.title as { absolute: string }).absolute).toContain(
      'Bookarium | Reader | Gutenberg Volume #77777'
    );
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
    expect((meta1.title as { absolute: string }).absolute).toBe(
      'Bookarium | Reader | Cached Wonder — Cache Master'
    );

    // Subsequent navigation uses server memory cache even if client navigation flag is absent
    const meta2 = await generateMetadata({
      params: Promise.resolve({ id: '55555' }),
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect((meta2.title as { absolute: string }).absolute).toBe(
      'Bookarium | Reader | Cached Wonder — Cache Master'
    );
  });

  it('renders children, Schema.org Book JSON-LD, and BreadcrumbList script', async () => {
    const layoutJsx = await BookReaderLayout({
      params: Promise.resolve({ id: '84' }),
      children: <div data-testid="reader-child">Reader Content</div>,
    });

    render(layoutJsx);

    expect(screen.getByTestId('reader-child')).toBeInTheDocument();

    const script = document.querySelector('script[type="application/ld+json"]');
    expect(script).toBeInTheDocument();
    const parsed = JSON.parse(script!.textContent || '{}');
    expect(parsed['@type']).toBe('Book');
    expect(parsed.bookFormat).toBe('https://schema.org/EBook');
    expect(parsed.identifier).toBe('gutenberg:84');
    expect(parsed.sameAs).toBe('https://www.gutenberg.org/ebooks/84');
    expect(parsed.name).toContain('Frankenstein');
    expect(parsed.author?.name).toContain('Shelley');
    expect(parsed.author?.birthDate).toBe('1797');
    expect(parsed.author?.deathDate).toBe('1851');
    expect(Array.isArray(parsed.genre)).toBe(true);
    expect(parsed.genre).toContain('Gothic');
    expect(parsed.keywords).toContain('Gothic');

    const breadcrumbScript = document.getElementById('reader-breadcrumb-jsonld');
    expect(breadcrumbScript).toBeInTheDocument();
    const breadcrumb = JSON.parse(breadcrumbScript!.textContent || '{}');
    expect(breadcrumb['@type']).toBe('BreadcrumbList');
    expect(breadcrumb.itemListElement).toHaveLength(2);
    expect(breadcrumb.itemListElement[1].item).toContain('/read/84');
  });

  it('enriches OpenGraph tags, meta keywords, translators, lifespan dates, formats, and JSON-LD genre array from catalog metadata', async () => {
    const mockTranslatedBook = {
      id: 2600,
      title: 'War and Peace',
      authors: [
        { name: 'Tolstoy, Leo', birth_year: 1828, death_year: 1910 },
        { name: 'Editor, Companion', birth_year: 1835, death_year: 1905 },
      ],
      translators: [{ name: 'Maude, Louise', birth_year: 1855, death_year: 1939 }],
      subjects: ['Historical fiction', 'War stories'],
      bookshelves: ['Best Books Ever Listings', 'Category: Russian Literature'],
      languages: ['en'],
      copyright: false,
      media_type: 'Text',
      formats: {
        'image/jpeg': 'https://example.com/2600.jpg',
        'application/epub+zip': 'https://www.gutenberg.org/ebooks/2600.epub3.images',
        'text/plain; charset=utf-8': 'https://www.gutenberg.org/files/2600/2600-0.txt',
      },
      download_count: 5000,
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [mockTranslatedBook] }),
    } as Response);

    const meta = await generateMetadata({
      params: Promise.resolve({ id: '2600' }),
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(meta.description).toContain('Genoa and Lucca');
    expect(meta.description).toContain('translated by Louise Maude');
    expect(meta.description).toContain('Historical');
    expect(meta.keywords).toEqual(
      expect.arrayContaining(['War and Peace', 'Leo Tolstoy', 'Louise Maude', 'Historical', 'War Stories'])
    );
    expect(meta.authors).toEqual([{ name: 'Leo Tolstoy' }, { name: 'Companion Editor' }]);

    const og = meta.openGraph as { type?: string; authors?: string[]; tags?: string[] } | undefined;
    expect(og?.type).toBe('book');
    expect(og?.authors).toEqual(['Leo Tolstoy', 'Companion Editor']);
    expect(og?.tags).toEqual(
      expect.arrayContaining(['Russian Literature', 'Historical Fiction', 'War Stories', 'Historical', 'War'])
    );
    expect(og?.tags).not.toContain('Best Books Ever Listings');

    const layoutJsx = await BookReaderLayout({
      params: Promise.resolve({ id: '2600' }),
      children: <div data-testid="translated-reader-child">Reader Content</div>,
    });
    render(layoutJsx);

    const script = document.querySelector('script[type="application/ld+json"]');
    expect(script).toBeInTheDocument();
    const parsed = JSON.parse(script!.textContent || '{}');
    expect(parsed.identifier).toBe('gutenberg:2600');
    expect(parsed.bookFormat).toBe('https://schema.org/EBook');
    expect(parsed.sameAs).toBe('https://www.gutenberg.org/ebooks/2600');
    expect(parsed.author).toEqual([
      { '@type': 'Person', name: 'Leo Tolstoy', birthDate: '1828', deathDate: '1910' },
      { '@type': 'Person', name: 'Companion Editor', birthDate: '1835', deathDate: '1905' },
    ]);
    expect(parsed.translator).toEqual({
      '@type': 'Person',
      name: 'Louise Maude',
      birthDate: '1855',
      deathDate: '1939',
    });
    expect(parsed.encoding).toEqual([
      { '@type': 'MediaObject', encodingFormat: 'application/epub+zip' },
      { '@type': 'MediaObject', encodingFormat: 'text/plain' },
    ]);
    expect(parsed.genre).toEqual(
      expect.arrayContaining(['Russian Literature', 'Historical Fiction', 'War Stories', 'Historical', 'War'])
    );
    expect(parsed.keywords).toContain('Historical');
  });

  it('marks explicitly confirmed-missing numeric book IDs as noindex while preserving fallback UI', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [] }),
    } as Response);

    const meta = await generateMetadata({
      params: Promise.resolve({ id: '999998' }),
    });

    expect(meta.robots).toEqual({ index: false, follow: true });
  });

  it('falls back gracefully without noindex when upstream fetch times out or fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new DOMException('The operation was aborted.', 'AbortError'));

    const meta = await generateMetadata({
      params: Promise.resolve({ id: '999999' }),
    });

    expect(meta.title).toBeDefined();
    expect(meta.description).toBeDefined();
    expect(meta.robots).toBeUndefined();

    const layoutJsx = await BookReaderLayout({
      params: Promise.resolve({ id: '999999' }),
      children: <div data-testid="fallback-child">Fallback Content</div>,
    });

    render(layoutJsx);
    expect(screen.getByTestId('fallback-child')).toBeInTheDocument();
  });
});


