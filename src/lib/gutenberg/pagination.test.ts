import { describe, it, expect } from 'vitest';
import {
  calculateReadingTime,
  getCharsPerPage,
  calculateVolumePageSpread,
  paginateChapterContent,
  clearPaginationCache,
} from './pagination';

describe('pagination subsystem', () => {
  it('correctly calculates reading time based on 200 WPM', () => {
    const text = new Array(400).fill('word').join(' ');
    expect(calculateReadingTime(text)).toBe(2);
  });

  it('calculates dynamic characters per page scaled by font size', () => {
    expect(getCharsPerPage(18)).toBe(5600);
    expect(getCharsPerPage(36)).toBe(2800);
    expect(getCharsPerPage(72)).toBe(1400);
  });

  it('calculates true continuous volume page spreads', () => {
    const rawChapters = [
      { id: 0, title: 'Preamble', displayTitle: 'Preamble', content: 'x'.repeat(10000), startPageNumber: 1, pageCount: 1 },
      { id: 1, title: 'Chapter 1', displayTitle: 'Chapter 1', content: 'x'.repeat(15000), startPageNumber: 1, pageCount: 1 },
      { id: 2, title: 'Chapter 2', displayTitle: 'Chapter 2', content: 'x'.repeat(5000), startPageNumber: 1, pageCount: 1 },
    ];

    const { chaptersWithPagination, totalVolumePages } = calculateVolumePageSpread(rawChapters, 18);
    // 5600 chars per page:
    // Preamble: 10000 / 5600 = 2 pages (pages 1-2)
    // Chapter 1: 15000 / 5600 = 3 pages (pages 3-5)
    // Chapter 2: 5000 / 5600 = 1 page (page 6)
    expect(chaptersWithPagination[0].startPageNumber).toBe(1);
    expect(chaptersWithPagination[0].pageCount).toBe(2);

    expect(chaptersWithPagination[1].startPageNumber).toBe(3);
    expect(chaptersWithPagination[1].pageCount).toBe(3);

    expect(chaptersWithPagination[2].startPageNumber).toBe(6);
    expect(chaptersWithPagination[2].pageCount).toBe(1);

    expect(totalVolumePages).toBe(6);
  });

  it('paginates chapter content snapping cleanly to sentence and word boundaries without splitting words', () => {
    const text = 'First sentence of the page. Second sentence of the page. Third sentence of the page. Fourth sentence of the page.';
    const pages = paginateChapterContent(text, 60);

    expect(pages.length).toBeGreaterThanOrEqual(2);
    // Ensure each page starts and ends on clean word/sentence boundaries
    for (const page of pages) {
      expect(page.trim()).not.toMatch(/^\S{1,2}\s/); // No orphaned fragments
      expect(page).not.toContain('\n\n\n');
    }

    expect(paginateChapterContent('', 100)).toEqual(['']);
    expect(paginateChapterContent('Short text', 500)).toEqual(['Short text']);

    // Test paragraph boundary snapping
    const multiParaText = 'First paragraph content that spans a good number of words.\n\nSecond paragraph starting fresh.\n\nThird paragraph concluding the section.';
    const paraPages = paginateChapterContent(multiParaText, 70);
    expect(paraPages.length).toBeGreaterThanOrEqual(2);

    // Test space boundary fallback (text without punctuation)
    const longUnpunctuated = 'word '.repeat(30).trim();
    const spacePages = paginateChapterContent(longUnpunctuated, 50);
    expect(spacePages.length).toBeGreaterThanOrEqual(2);
    expect(spacePages[0].endsWith('word')).toBe(true);
  });

  it('caches and retrieves paginated chapter content with clearPaginationCache support', () => {
    const longChapter = 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.\n\n' + 'Word '.repeat(1000);
    const pages1 = paginateChapterContent(longChapter, 500);
    const pages2 = paginateChapterContent(longChapter, 500);

    expect(pages1).toBe(pages2); // Referential equality from LRU cache
    clearPaginationCache();
    const pages3 = paginateChapterContent(longChapter, 500);
    expect(pages3).toEqual(pages1);
  });
});

