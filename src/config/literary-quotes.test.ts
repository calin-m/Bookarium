import { describe, it, expect } from 'vitest';
import { LITERARY_QUOTES, getJurisdictionSafeLiteraryQuotes } from './literary-quotes';

describe('literary-quotes configuration & jurisdiction filtering', () => {
  it('maintains a rich collection of unique, well-formed literary quotes', () => {
    expect(LITERARY_QUOTES.length).toBeGreaterThanOrEqual(30);
    const ids = new Set(LITERARY_QUOTES.map((q) => q.id));
    expect(ids.size).toBe(LITERARY_QUOTES.length);

    for (const quote of LITERARY_QUOTES) {
      expect(quote.bookId).toBeGreaterThan(0);
      expect(quote.bookTitle.length).toBeGreaterThan(0);
      expect(quote.author.length).toBeGreaterThan(0);
      expect(quote.quote.length).toBeGreaterThan(10);
      expect(quote.citation.length).toBeGreaterThan(0);
    }
  });

  it('returns all quotes for US default jurisdiction and filters Life+70 / Life+100 restricted quotes', () => {
    const usQuotes = getJurisdictionSafeLiteraryQuotes('US');
    expect(usQuotes.length).toBe(LITERARY_QUOTES.length);

    const defaultQuotes = getJurisdictionSafeLiteraryQuotes();
    expect(defaultQuotes.length).toBe(LITERARY_QUOTES.length);

    // In Life+70 (DE), Lionel Giles (d. 1958) translation of The Art of War (bookId 132) is filtered out
    const deQuotes = getJurisdictionSafeLiteraryQuotes('DE');
    expect(deQuotes.some((q) => q.bookId === 132)).toBe(false);
    expect(deQuotes.some((q) => q.bookId === 1342)).toBe(true);

    // In Life+100 (MX), F. Scott Fitzgerald (d. 1940, bookId 64317) is also filtered out
    const mxQuotes = getJurisdictionSafeLiteraryQuotes('MX');
    expect(mxQuotes.length).toBeLessThan(deQuotes.length);
    expect(mxQuotes.some((q) => q.bookId === 64317)).toBe(false);
    expect(mxQuotes.some((q) => q.bookId === 1342)).toBe(true);
  });
});

