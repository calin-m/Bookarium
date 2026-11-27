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

  it('extracts position metadata cleanly and flags shouldHealRemoteMetadata when cloud lacks title or authors', () => {
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

    const decodedWithMissingCloudMeta = decodeRemoteReadingPosition(
      {
        book_id: 901,
        current_chapter_index: 3,
        scroll_offset: 7,
        progress_percent: 55,
        last_read_at: '2026-11-27T12:00:00Z',
        book_title: null,
        book_authors: [],
        cover_url: null,
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

    expect(decodedWithMissingCloudMeta.shouldKeepLocalAuthors).toBe(false);
    expect(decodedWithMissingCloudMeta.shouldHealRemoteMetadata).toBe(true);
    expect(decodedWithMissingCloudMeta.position.bookTitle).toBe('Persuasion');
    expect(decodedWithMissingCloudMeta.position.bookAuthors).toEqual(['Jane Austen']);
  });
});

