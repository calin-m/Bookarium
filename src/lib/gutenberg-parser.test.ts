import { describe, it, expect } from 'vitest';
import * as gutenbergParser from './gutenberg-parser';

describe('src/lib/gutenberg-parser (Facade Barrel)', () => {
  it('re-exports all core Gutenberg subsystems and functions without regression', () => {
    expect(typeof gutenbergParser.parseGutenbergChapters).toBe('function');
    expect(typeof gutenbergParser.calculateReadingTime).toBe('function');
    expect(typeof gutenbergParser.calculateVolumePageSpread).toBe('function');
    expect(typeof gutenbergParser.getCharsPerPage).toBe('function');
    expect(typeof gutenbergParser.reflowGutenbergParagraphs).toBe('function');
    expect(typeof gutenbergParser.extractGutenbergHeaderMetadata).toBe('function');
    expect(typeof gutenbergParser.paginateChapterContent).toBe('function');
    expect(typeof gutenbergParser.extractDynamicBookPassages).toBe('function');
    expect(typeof gutenbergParser.clearPaginationCache).toBe('function');
    expect(gutenbergParser.GUTENBERG_PARSER_CONFIG).toBeDefined();
  });

  it('delegates parsing correctly through the facade', () => {
    const raw = 'CHAPTER 1\n\nIt was the best of times.';
    const chapters = gutenbergParser.parseGutenbergChapters(raw);
    expect(chapters.length).toBeGreaterThanOrEqual(1);

    const reflowed = gutenbergParser.reflowGutenbergParagraphs('Line 1\nLine 2');
    expect(reflowed).toBe('Line 1 Line 2');

    const pages = gutenbergParser.paginateChapterContent('Sample text for testing', 100);
    expect(pages).toEqual(['Sample text for testing']);
  });
});
