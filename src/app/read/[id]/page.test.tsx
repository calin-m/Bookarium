import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import BookReaderPage from './page';
import { clearServerMetadataCache, setServerMetadataCache } from './reader-layout-utils';
import type { CatalogBook } from '@/types/book.types';

const mockNotFoundError = new Error('NEXT_HTTP_ERROR_FALLBACK;404');

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw mockNotFoundError;
  }),
}));

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

vi.mock('@/components/reader/BookReaderClient', () => ({
  BookReaderClient: ({ initialBook }: { initialBook?: CatalogBook | null }) => (
    <div data-testid="mock-book-reader-client">
      {initialBook ? (
        <article>
          <h1>{initialBook.title}</h1>
          <p>{initialBook.authors?.[0]?.name}</p>
          {initialBook.quotes?.[0]?.openingLine && <p>{initialBook.quotes[0].openingLine}</p>}
        </article>
      ) : (
        <span>no-initial-book</span>
      )}
    </div>
  ),
}));

describe('BookReaderPage Server Component (/read/[id])', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    clearServerMetadataCache();
    vi.mocked(headers).mockResolvedValue(new Headers());
  });

  it('calls notFound() immediately for invalid or non-positive book IDs', async () => {
    await expect(
      BookReaderPage({ params: Promise.resolve({ id: 'invalid-book' }) })
    ).rejects.toThrow(mockNotFoundError);
    await expect(
      BookReaderPage({ params: Promise.resolve({ id: '0' }) })
    ).rejects.toThrow(mockNotFoundError);
    expect(notFound).toHaveBeenCalledTimes(2);
  });

  it('resolves curated book metadata on SSR and passes initialBook to BookReaderClient', async () => {
    const jsx = await BookReaderPage({ params: Promise.resolve({ id: '1342' }) });
    render(jsx);

    expect(screen.getByRole('heading', { name: /Pride and Prejudice/i })).toBeInTheDocument();
    expect(screen.getByText(/Jane Austen/i)).toBeInTheDocument();
    expect(notFound).not.toHaveBeenCalled();
  });

  it('bypasses DB fetch on rsc: 1 client transitions unless book is already cached', async () => {
    vi.mocked(headers).mockResolvedValue(new Headers({ rsc: '1' }));

    const jsxCold = await BookReaderPage({ params: Promise.resolve({ id: '77777' }) });
    render(jsxCold);
    expect(screen.getByText('no-initial-book')).toBeInTheDocument();

    setServerMetadataCache(77777, {
      id: 77777,
      title: 'Warm Cached Monograph',
      authors: [{ name: 'Scholar, Warm' }],
      translators: [],
      subjects: [],
      bookshelves: [],
      languages: ['en'],
      copyright: false,
      media_type: 'Text',
      formats: {},
      download_count: 12,
    });

    const jsxWarm = await BookReaderPage({ params: Promise.resolve({ id: '77777' }) });
    render(jsxWarm);
    expect(screen.getByRole('heading', { name: 'Warm Cached Monograph' })).toBeInTheDocument();
  });

  it('calls notFound() only when configured Supabase cleanly confirms book ID does not exist', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://valid-project.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'valid-anon-key-12345');

    const supabaseClientModule = await import('@/lib/supabase/client');
    vi.spyOn(supabaseClientModule, 'createClient').mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            abortSignal: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      }),
    } as unknown as ReturnType<typeof supabaseClientModule.createClient>);

    await expect(
      BookReaderPage({ params: Promise.resolve({ id: '999999' }) })
    ).rejects.toThrow(mockNotFoundError);
    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it('degrades gracefully without notFound() when Supabase lookup fails or is unconfigured', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://valid-project.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'valid-anon-key-12345');

    const supabaseClientModule = await import('@/lib/supabase/client');
    vi.spyOn(supabaseClientModule, 'createClient').mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            abortSignal: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockRejectedValue(new Error('DB transient error')),
            }),
          }),
        }),
      }),
    } as unknown as ReturnType<typeof supabaseClientModule.createClient>);

    const jsx = await BookReaderPage({ params: Promise.resolve({ id: '55555' }) });
    render(jsx);
    expect(screen.getByText('no-initial-book')).toBeInTheDocument();
    expect(notFound).not.toHaveBeenCalled();
  });
});
