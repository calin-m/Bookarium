import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GutendexCatalogProvider } from './gutendex-provider';
import { CatalogProviderError } from '@/types/catalog.types';

describe('GutendexCatalogProvider', () => {
  let provider: GutendexCatalogProvider;

  beforeEach(() => {
    provider = new GutendexCatalogProvider();
    vi.restoreAllMocks();
  });

  it('has name "gutendex"', () => {
    expect(provider.name).toBe('gutendex');
  });

  it('searches books, enforces copyright=false, and calculates latency', async () => {
    let capturedUrl = '';
    const mockData = {
      count: 1,
      next: null,
      previous: null,
      results: [
        {
          id: 1342,
          title: 'Pride and Prejudice',
          authors: [{ name: 'Austen, Jane', birth_year: 1775, death_year: 1817 }],
          translators: [],
          subjects: [],
          bookshelves: [],
          languages: ['en'],
          copyright: false,
          media_type: 'Text',
          formats: {},
          download_count: 5000,
        },
      ],
    };

    vi.spyOn(global, 'fetch').mockImplementationOnce(async (input) => {
      capturedUrl = String(input);
      return new Response(JSON.stringify(mockData), { status: 200 });
    });

    const result = await provider.searchBooks({
      search: 'Jane Austen',
      page: 1,
      limit: 32,
      country: 'US',
    });

    expect(capturedUrl).toContain('copyright=false');
    expect(capturedUrl).toContain('search=Jane+Austen');
    expect(result.source).toBe('upstream');
    expect(result.clientCountry).toBe('US');
    expect(result.jurisdictionRule).toBe('US_PUBLIC_DOMAIN');
    expect(result.results).toHaveLength(1);
    expect(result.results[0].title).toBe('Pride and Prejudice');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('applies jurisdictional filtering when queried from GB', async () => {
    const mockData = {
      count: 2,
      results: [
        {
          id: 1342,
          title: 'Pride and Prejudice',
          authors: [{ name: 'Austen, Jane', birth_year: 1775, death_year: 1817 }],
          translators: [],
          copyright: false,
        },
        {
          id: 863,
          title: 'The Mysterious Affair at Styles',
          authors: [{ name: 'Christie, Agatha', birth_year: 1890, death_year: 1976 }],
          translators: [],
          copyright: false,
        },
      ],
    };

    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockData), { status: 200 })
    );

    const result = await provider.searchBooks({
      search: 'mystery',
      page: 1,
      limit: 32,
      country: 'GB',
    });

    expect(result.clientCountry).toBe('GB');
    expect(result.jurisdictionRule).toBe('LIFE_70');
    expect(result.totalFiltered).toBe(1);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].title).toBe('Pride and Prejudice');
  });

  it('throws CatalogProviderError with status 400 on upstream bad request', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: 'Invalid query parameter' }), {
        status: 400,
        statusText: 'Bad Request',
      })
    );

    await expect(
      provider.searchBooks({ page: 999999, limit: 32, country: 'US' })
    ).rejects.toThrow(CatalogProviderError);
  });

  it('throws CatalogProviderError with status 502 on network failure', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Connection reset'));

    try {
      await provider.searchBooks({ page: 1, limit: 32, country: 'US' });
      expect.unreachable('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(CatalogProviderError);
      expect((err as CatalogProviderError).statusCode).toBe(502);
      expect((err as CatalogProviderError).message).toContain('Unable to connect to Gutenberg API');
    }
  });

  it('throws CatalogProviderError with status 504 on request timeout', async () => {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(abortError);

    try {
      await provider.searchBooks({ page: 1, limit: 32, country: 'US' });
      expect.unreachable('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(CatalogProviderError);
      expect((err as CatalogProviderError).statusCode).toBe(504);
      expect((err as CatalogProviderError).message).toContain('Gutenberg API request timed out');
    }
  });

  it('throws CatalogProviderError with status 502 on invalid non-JSON body', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response('<html>Error</html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      })
    );

    try {
      await provider.searchBooks({ page: 1, limit: 32, country: 'US' });
      expect.unreachable('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(CatalogProviderError);
      expect((err as CatalogProviderError).statusCode).toBe(502);
      expect((err as CatalogProviderError).message).toContain('Invalid JSON response');
    }
  });

  it('checks isHealthy via HEAD request', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(null, { status: 200 }));
    expect(await provider.isHealthy()).toBe(true);

    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Down'));
    expect(await provider.isHealthy()).toBe(false);
  });
});

