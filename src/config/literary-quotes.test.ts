import { describe, it, expect } from 'vitest';
import {
  LITERARY_QUOTES,
  getJurisdictionSafeLiteraryQuotes,
  selectHourlyLiteraryQuotes,
} from './literary-quotes';

describe('literary-quotes configuration & jurisdiction filtering', () => {
  it('maintains a rich collection of unique, well-formed literary quotes', () => {
    expect(LITERARY_QUOTES.length).toBeGreaterThanOrEqual(36);
    const ids = new Set(LITERARY_QUOTES.map((q) => q.id));
    expect(ids.size).toBe(LITERARY_QUOTES.length);

    for (const quote of LITERARY_QUOTES) {
      expect(quote.id).toBeGreaterThan(0);
      expect(quote.bookId).toBeGreaterThan(0);
      expect(quote.bookTitle.length).toBeGreaterThan(0);
      expect(quote.author.length).toBeGreaterThan(0);
      expect(quote.quote.length).toBeGreaterThan(10);
      expect(quote.citation.length).toBeGreaterThan(0);
      expect(quote.authorBirthYear).toBeDefined();
      expect(quote.authorDeathYear).toBeDefined();
    }
  });

  it('returns all quotes for US default jurisdiction and filters Life+70 / Life+100 restricted quotes', () => {
    const usQuotes = getJurisdictionSafeLiteraryQuotes('US');
    expect(usQuotes.length).toBe(LITERARY_QUOTES.length);

    const defaultQuotes = getJurisdictionSafeLiteraryQuotes();
    expect(defaultQuotes.length).toBe(LITERARY_QUOTES.length);

    // In Life+70 (DE / RO), Lionel Giles (d. 1958) translation of The Art of War (bookId 132) and modern Wyllie translation (bookId 5200) are filtered out
    const deQuotes = getJurisdictionSafeLiteraryQuotes('DE');
    expect(deQuotes.some((q) => q.bookId === 132)).toBe(false);
    expect(deQuotes.some((q) => q.bookId === 1342)).toBe(true);

    const roQuotes = getJurisdictionSafeLiteraryQuotes('RO');
    expect(roQuotes.some((q) => q.bookId === 5200)).toBe(false);
    expect(roQuotes.some((q) => q.bookId === 132)).toBe(false);
    expect(roQuotes.some((q) => q.bookTitle === 'Pride and Prejudice')).toBe(true);
    expect(roQuotes.some((q) => q.bookTitle === 'War and Peace')).toBe(true);

    // In Life+100 (MX), F. Scott Fitzgerald (d. 1940, bookId 64317) and Aylmer Maude (d. 1938, War and Peace) are also filtered out
    const mxQuotes = getJurisdictionSafeLiteraryQuotes('MX');
    expect(mxQuotes.length).toBeLessThan(deQuotes.length);
    expect(mxQuotes.some((q) => q.bookId === 64317)).toBe(false);
    expect(mxQuotes.some((q) => q.bookTitle === 'War and Peace')).toBe(false);
    expect(mxQuotes.some((q) => q.bookId === 1342)).toBe(true);
  });

  it('handles empty candidate pools and small distinct-book pools in selectHourlyLiteraryQuotes', () => {
    expect(selectHourlyLiteraryQuotes([], 0)).toEqual([]);

    const twoBookQuotes = [
      { ...LITERARY_QUOTES[0], id: 101, bookId: 1342 },
      { ...LITERARY_QUOTES[1], id: 102, bookId: 1342 },
      { ...LITERARY_QUOTES[2], id: 201, bookId: 84 },
    ];
    const selected = selectHourlyLiteraryQuotes(twoBookQuotes, 5, 3);
    expect(selected).toHaveLength(3);
    expect(selected.map((q) => q.id)).toEqual([101, 201, 102]);
  });
});

