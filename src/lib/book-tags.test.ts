import { describe, it, expect } from 'vitest';
import { resolveBookTags } from './book-tags';

describe('resolveBookTags', () => {
  it('resolves Frankenstein into concise canonical genres without character name noise', () => {
    const subjects = [
      'Frankenstein (Fictitious character) -- Fiction',
      "Frankenstein's monster (Fictitious character) -- Fiction",
      'Gothic fiction',
      'Horror tales',
      'Monsters -- Fiction',
      'Science fiction',
      'Scientists -- Fiction',
    ];
    const bookshelves = ['Gothic Fiction', 'Science Fiction', 'Precursors of Science Fiction'];

    const result = resolveBookTags(subjects, bookshelves);

    // Mobile gets exactly 1 punchy badge
    expect(result.primaryMobile).toEqual(['Gothic']);
    expect(result.primaryMobile[0].length).toBeLessThanOrEqual(14);
    expect(result.primaryMobile[0]).not.toContain('...');

    // Desktop gets 2 punchy badges
    expect(result.primaryDesktop).toEqual(['Gothic', 'Sci-Fi']);
    expect(result.primaryDesktop[1].length).toBeLessThanOrEqual(14);

    // Filtered out "(Fictitious character)"
    expect(result.allTags.some((t) => t.includes('Fictitious'))).toBe(false);

    // Overflow counts are accurate
    expect(result.overflowMobile).toBeGreaterThan(0);
    expect(result.overflowDesktop).toBe(result.overflowMobile - 1);
  });

  it('resolves Pride and Prejudice into Classics and Romance rather than geographic subdivisions', () => {
    const subjects = [
      'Courtship -- Fiction',
      'Domestic fiction',
      'England -- Social life and customs -- 19th century -- Fiction',
      'Love stories',
      'Sisters -- Fiction',
      'Young women -- Fiction',
    ];
    const bookshelves = ['Best Books Ever Listings', 'Classic Literature', 'Romantic Fiction'];

    const result = resolveBookTags(subjects, bookshelves);

    // Filtered out administrative "Best Books Ever Listings"
    expect(result.allTags.some((t) => t.includes('Best Books'))).toBe(false);

    // Primary tags prioritize curated genres
    expect(result.primaryDesktop).toEqual(['Classics', 'Romance']);
    expect(result.primaryMobile).toEqual(['Classics']);

    // Unabridged tags contain cleaned topics
    expect(result.allTags).toContain('Courtship');
    expect(result.allTags).toContain('Domestic Fiction');
  });

  it('resolves Dracula into Gothic and Horror/Vampires', () => {
    const subjects = [
      'Dracula, Count (Fictitious character) -- Fiction',
      'Epistolary fiction',
      'Gothic fiction',
      'Transylvania (Romania) -- Fiction',
      'Vampires -- Fiction',
      'Whitby (England) -- Fiction',
    ];
    const bookshelves = ['Horror Fiction', 'Gothic Fiction'];

    const result = resolveBookTags(subjects, bookshelves);

    expect(result.primaryDesktop).toEqual(['Horror', 'Gothic']);
    expect(result.primaryMobile).toEqual(['Horror']);
    expect(result.allTags).toContain('Vampires');
    expect(result.allTags).toContain('Epistolary Fiction');
  });

  it('resolves Alice in Wonderland with curated Childrens Literature', () => {
    const subjects = [
      'Alice (Fictitious character : Carroll) -- Juvenile fiction',
      'Fantasy fiction',
      'Imaginary places -- Juvenile fiction',
    ];
    const bookshelves = ["Children's Literature", 'Classic Literature'];

    const result = resolveBookTags(subjects, bookshelves);

    expect(result.primaryDesktop).toEqual(["Children's", 'Classics']);
    expect(result.primaryMobile).toEqual(["Children's"]);
  });

  it('resolves The Republic into Philosophy and Politics', () => {
    const subjects = [
      'Classical literature',
      'Political science -- Early works to 1800',
      'Utopias -- Early works to 1800',
    ];
    const bookshelves = ['Philosophy', 'Politics', 'Classics'];

    const result = resolveBookTags(subjects, bookshelves);

    expect(result.primaryDesktop).toEqual(['Philosophy', 'Politics']);
    expect(result.primaryMobile).toEqual(['Philosophy']);
  });

  it('safely falls back to Classics on undefined, null, or empty inputs', () => {
    const r1 = resolveBookTags(undefined, undefined);
    expect(r1.primaryMobile).toEqual(['Classics']);
    expect(r1.primaryDesktop).toEqual(['Classics']);
    expect(r1.overflowMobile).toBe(0);
    expect(r1.overflowDesktop).toBe(0);
    expect(r1.allTags).toEqual(['Classics']);

    const r2 = resolveBookTags([], []);
    expect(r2.primaryMobile).toEqual(['Classics']);
    expect(r2.primaryDesktop).toEqual(['Classics']);

    const r3 = resolveBookTags([''], ['   ']);
    expect(r3.primaryMobile).toEqual(['Classics']);
  });

  it('guarantees that every resolved badge never contains ellipsis and is <= 14 chars', () => {
    const verboseSubjects = [
      'Precursors of Science Fiction and Speculative Fantasy in the 19th Century',
      'Detective and mystery stories featuring consulting detectives in Victorian London',
      'Historical fiction set in the Napoleonic Wars',
    ];
    const result = resolveBookTags(verboseSubjects, null);

    for (const badge of result.primaryDesktop) {
      expect(badge).not.toContain('...');
      expect(badge.length).toBeLessThanOrEqual(14);
    }
    for (const badge of result.primaryMobile) {
      expect(badge).not.toContain('...');
      expect(badge.length).toBeLessThanOrEqual(14);
    }
  });

  it('strips administrative Category and Banned Books prefixes from unabridged tags', () => {
    const bookshelves = [
      'Category: British Literature',
      'Category: Novels',
      'Categories: Classics of Literature',
      'Banned Books from Anne Arundel County: Fiction',
    ];
    const subjects = ['British Literature -- 19th century'];

    const result = resolveBookTags(subjects, bookshelves);

    expect(result.allTags).toContain('British Literature');
    expect(result.allTags).toContain('Novels');
    expect(result.allTags).toContain('Classics of Literature');
    expect(result.allTags).toContain('Fiction');
    expect(result.allTags.some((t) => t.toLowerCase().includes('category:'))).toBe(false);
    expect(result.allTags.some((t) => t.toLowerCase().includes('banned books from'))).toBe(false);
  });
});
