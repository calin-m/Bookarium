import { describe, it, expect } from 'vitest';
import {
  hasEmbeddedLifespans,
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
});

