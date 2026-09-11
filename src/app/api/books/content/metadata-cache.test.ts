import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  clearBookMetadataCache,
  resolveBookMetadata,
  setBookMetadataCache,
  getBookMetadataCache,
} from './metadata-cache';

describe('metadata-cache', () => {
  beforeEach(() => {
    clearBookMetadataCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    clearBookMetadataCache();
    vi.restoreAllMocks();
  });

  it('stores and retrieves cached metadata correctly', () => {
    const mockBook = {
      id: 1234,
      title: 'Sample Book',
      authors: [{ name: 'Author, A.', birth_year: null, death_year: 1940 }],
    };
    setBookMetadataCache(1234, { book: mockBook, expiresAt: Date.now() + 10000 });

    const cached = getBookMetadataCache(1234);
    expect(cached?.book.title).toBe('Sample Book');

    clearBookMetadataCache();
    expect(getBookMetadataCache(1234)).toBeUndefined();
  });

  it('returns cached metadata if not expired without network fetch', async () => {
    const mockBook = {
      id: 999,
      title: 'Cached Title',
      authors: [],
    };
    setBookMetadataCache(999, { book: mockBook, expiresAt: Date.now() + 60000 });

    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const result = await resolveBookMetadata(999);

    expect(result).toEqual(mockBook);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fetches metadata from upstream when not cached', async () => {
    const mockUpstreamBook = {
      id: 888,
      title: 'Upstream Book',
      authors: [{ name: 'Writer, W.', birth_year: null, death_year: 1930 }],
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockUpstreamBook), { status: 200 })
    );

    const result = await resolveBookMetadata(888);
    expect(result).toEqual(mockUpstreamBook);

    // Should now be cached
    const cached = getBookMetadataCache(888);
    expect(cached?.book.title).toBe('Upstream Book');
  });

  it('returns null when upstream returns error status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Not Found', { status: 404 })
    );

    const result = await resolveBookMetadata(777);
    expect(result).toBeNull();
  });

  it('returns null when network throws an error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network offline'));

    const result = await resolveBookMetadata(666);
    expect(result).toBeNull();
  });
});
