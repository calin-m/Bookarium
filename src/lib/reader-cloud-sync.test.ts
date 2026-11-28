import { describe, it, expect } from 'vitest';
import {
  hasEmbeddedLifespans,
  hasAuthenticPositionTitle,
  hasAuthenticPositionAuthors,
  extractBookPositionMetadata,
  isGhostReadingPosition,
  isGhostCloudRow,
  decodeRemoteReadingPosition,
  extractVerifiedAuthors,
  registerLocalBookPoolResolver,
  resolveLocalCachedBook,
} from './reader-cloud-sync';

describe('reader-cloud-sync', () => {
  it('identifies ghost reading positions and ghost cloud rows', () => {
    expect(
      isGhostReadingPosition(
        { chapterIndex: 0, chapterPage: 1, globalPage: 1, lastReadAt: '2026-01-01' },
        0
      )
    ).toBe(true);
    expect(
      isGhostReadingPosition(
        {
          chapterIndex: 0,
          chapterPage: 1,
          globalPage: 1,
          bookmarkRow: 3,
          lastReadAt: '2026-01-01',
        },
        0
      )
    ).toBe(false);

    expect(
      isGhostCloudRow({
        progress_percent: 0,
        current_chapter_index: 0,
        scroll_offset: 1,
        bookmark_text: null,
      })
    ).toBe(true);
  });

  it('decodes remote reading positions and preserves local lifespans when remote lacks them', () => {
    expect(hasEmbeddedLifespans(['Jane Austen (1775-1817)'])).toBe(true);
    expect(hasEmbeddedLifespans(['Jane Austen'])).toBe(false);

    const decoded = decodeRemoteReadingPosition(
      {
        current_chapter_index: 2,
        scroll_offset: 3.005,
        progress_percent: 45,
        bookmark_text: 'Call me Ishmael',
        last_read_at: '2026-02-01T00:00:00Z',
        book_title: 'Moby-Dick',
        book_authors: ['Herman Melville'],
      },
      {
        chapterIndex: 2,
        chapterPage: 3,
        globalPage: 3,
        lastReadAt: '2026-01-01T00:00:00Z',
        bookAuthors: ['Herman Melville (1819-1891)'],
      }
    );

    expect(decoded.position.chapterPage).toBe(3);
    expect(decoded.position.bookmarkRow).toBe(5);
    expect(decoded.position.bookmarkText).toBe('Call me Ishmael');
    expect(decoded.shouldKeepLocalAuthors).toBe(true);
    expect(decoded.position.bookAuthors).toEqual(['Herman Melville (1819-1891)']);

    const verified = extractVerifiedAuthors(undefined, decoded.position);
    expect(verified).toEqual([
      { name: 'Herman Melville (1819-1891)', birth_year: 1819, death_year: 1891 },
    ]);
  });

  it('extracts position metadata cleanly and hydrates lean cloud rows from public.books or local fallbacks', () => {
    expect(hasAuthenticPositionTitle(null)).toBe(false);
    expect(hasAuthenticPositionTitle('Gutenberg Volume #84')).toBe(false);
    expect(hasAuthenticPositionTitle('Pride and Prejudice')).toBe(true);
    expect(hasAuthenticPositionAuthors([])).toBe(false);
    expect(hasAuthenticPositionAuthors(['Anonymous'])).toBe(false);
    expect(hasAuthenticPositionAuthors(['Jane Austen'])).toBe(true);

    expect(extractBookPositionMetadata(0, null)).toEqual({});
    expect(
      extractBookPositionMetadata(84, {
        id: 84,
        title: 'The Project Gutenberg eBook of Frankenstein',
        authors: [{ name: 'Shelley, Mary', birth_year: 1797, death_year: 1851 }],
        formats: {
          'image/jpeg': 'https://www.gutenberg.org/cache/epub/84/pg84.cover.medium.jpg',
        },
      })
    ).toEqual({
      bookTitle: 'Frankenstein',
      bookAuthors: ['Shelley, Mary, 1797-1851'],
      coverUrl: '/api/books/content?id=84&type=cover',
    });

    const decodedWithLocalFallback = decodeRemoteReadingPosition(
      {
        book_id: 901,
        current_chapter_index: 3,
        scroll_offset: 7,
        progress_percent: 55,
        last_read_at: '2026-11-27T12:00:00Z',
      },
      {
        chapterIndex: 1,
        chapterPage: 2,
        globalPage: 2,
        lastReadAt: '2026-11-26T12:00:00Z',
        bookTitle: 'Persuasion',
        bookAuthors: ['Jane Austen'],
        coverUrl: '/api/books/content?id=901&type=cover',
      }
    );

    expect(decodedWithLocalFallback.shouldKeepLocalAuthors).toBe(false);
    expect(decodedWithLocalFallback.position.bookTitle).toBe('Persuasion');
    expect(decodedWithLocalFallback.position.bookAuthors).toEqual(['Jane Austen']);

    const decodedFromCatalog = decodeRemoteReadingPosition(
      {
        book_id: 84,
        current_chapter_index: 2,
        scroll_offset: 4,
        progress_percent: 25,
        last_read_at: '2026-11-28T12:00:00Z',
      },
      undefined,
      {
        id: 84,
        title: 'Frankenstein',
        authors: [{ name: 'Shelley, Mary', birth_year: 1797, death_year: 1851 }],
        translators: [],
        subjects: [],
        bookshelves: [],
        languages: ['en'],
        copyright: false,
        media_type: 'Text',
        formats: {},
        download_count: 500,
      }
    );
    expect(decodedFromCatalog.position.bookTitle).toBe('Frankenstein');
    expect(decodedFromCatalog.position.bookAuthors).toEqual(['Shelley, Mary, 1797-1851']);
    expect(decodedFromCatalog.position.coverUrl).toBe('/api/books/content?id=84&type=cover');
  });

  it('resolves cached book metadata in memory via registered local pool or FEATURED_HERO_BOOKS while rejecting placeholders', () => {
    try {
      expect(resolveLocalCachedBook(0)).toBeUndefined();
      expect(resolveLocalCachedBook(-5)).toBeUndefined();

      // Bundled featured classic resolves with lifespans even without a registered pool
      registerLocalBookPoolResolver(null);
      const hero = resolveLocalCachedBook(1342);
      expect(hero?.title).toBe('Pride and Prejudice');
      expect(hero?.authors[0]?.death_year).toBe(1817);
      expect(resolveLocalCachedBook(79835)).toBeUndefined();

      // Registered pool serves authentic books with lifespans and ignores placeholder-titled entries
      registerLocalBookPoolResolver((bookId) => {
        if (bookId === 79835) {
          return {
            id: 79835,
            title: 'Cached Monograph',
            authors: [{ name: 'Scholar, Classic', birth_year: 1810, death_year: 1880 }],
            translators: [],
            subjects: [],
            bookshelves: [],
            languages: ['en'],
            copyright: false,
            media_type: 'Text',
            formats: {},
            download_count: 250,
          };
        }
        if (bookId === 79836) {
          return {
            id: 79836,
            title: 'Volume #79836',
            authors: [{ name: 'Scholar, Classic', birth_year: 1810, death_year: 1880 }],
            translators: [],
            subjects: [],
            bookshelves: [],
            languages: ['en'],
            copyright: false,
            media_type: 'Text',
            formats: {},
            download_count: 100,
          };
        }
        return undefined;
      });

      expect(resolveLocalCachedBook(79835)?.title).toBe('Cached Monograph');
      expect(resolveLocalCachedBook(79836)).toBeUndefined();
    } finally {
      registerLocalBookPoolResolver(null);
    }
  });
});

