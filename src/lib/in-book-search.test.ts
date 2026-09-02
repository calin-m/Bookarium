import { describe, it, expect } from 'vitest';
import { searchInBook } from './in-book-search';
import type { ChapterSection } from './gutenberg-parser';

const sampleChapters: ChapterSection[] = [
  {
    id: 1,
    title: 'CHAPTER I',
    displayTitle: 'Chapter I: An Opening Reflection',
    content: 'It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife. However little known the feelings or views of such a man may be on his first entering a neighbourhood.',
    startPageNumber: 1,
    pageCount: 1,
  },
  {
    id: 2,
    title: 'CHAPTER II',
    displayTitle: 'Chapter II: Mr. Bennet Visits',
    content: 'Mr. Bennet was among the earliest of those who waited on Mr. Bingley. He had always intended to visit him, though to the last always assuring his wife that he should not go. With Elizabeth and Jane listening carefully.',
    startPageNumber: 2,
    pageCount: 1,
  },
  {
    id: 3,
    title: 'CHAPTER III',
    displayTitle: 'Chapter III: The Netherfield Ball',
    content: 'Not all that Mrs. Bennet, however, with the assistance of her five daughters, could ask on the subject, was sufficient to draw from her husband any satisfactory description of Mr. Bingley. Elizabeth admired his good humor.',
    startPageNumber: 3,
    pageCount: 1,
  },
];

describe('in-book-search utility', () => {
  it('returns empty result when chapters array is empty or undefined', () => {
    const res1 = searchInBook([], 'truth');
    expect(res1.totalMatches).toBe(0);
    expect(res1.matches).toHaveLength(0);

    const res2 = searchInBook(null, 'truth');
    expect(res2.totalMatches).toBe(0);
  });

  it('returns empty result when search query is empty, whitespace, or less than 2 chars', () => {
    const res1 = searchInBook(sampleChapters, '');
    expect(res1.totalMatches).toBe(0);

    const res2 = searchInBook(sampleChapters, '   ');
    expect(res2.totalMatches).toBe(0);

    const res3 = searchInBook(sampleChapters, 'a');
    expect(res3.totalMatches).toBe(0);
  });

  it('finds exact case-insensitive matches across chapters', () => {
    const res = searchInBook(sampleChapters, 'Bingley');
    expect(res.totalMatches).toBe(2);
    expect(res.matchedChapterCount).toBe(2);
    expect(res.matches[0].chapterIndex).toBe(1);
    expect(res.matches[0].matchedText).toBe('Bingley');
    expect(res.matches[1].chapterIndex).toBe(2);
    expect(res.matches[1].matchedText).toBe('Bingley');
  });

  it('finds phrase matches preserving surrounding context and pagination coordinates', () => {
    const res = searchInBook(sampleChapters, 'truth universally acknowledged');
    expect(res.totalMatches).toBe(1);
    expect(res.matches[0].chapterIndex).toBe(0);
    expect(res.matches[0].chapterTitle).toBe('CHAPTER I');
    expect(res.matches[0].chapterPage).toBe(1);
    expect(res.matches[0].globalPage).toBe(1);
    expect(res.matches[0].matchedText).toBe('truth universally acknowledged');
    expect(res.matches[0].snippetBefore).toContain('It is a ');
    expect(res.matches[0].snippetAfter).toContain('that a single man');
  });

  it('safely handles regex special characters and punctuation in query', () => {
    const res = searchInBook(sampleChapters, 'Mr. Bennet');
    expect(res.totalMatches).toBe(1);
    expect(res.matches[0].matchedText).toBe('Mr. Bennet');

    const res2 = searchInBook(sampleChapters, 'wife? (not found)');
    expect(res2.totalMatches).toBe(0);
  });

  it('handles diacritic normalization fallback', () => {
    const accentedChapters: ChapterSection[] = [
      {
        id: 1,
        title: 'CHAPTER I',
        displayTitle: 'Chapter I: Les Misérables',
        content: 'Jean Valjean wandered into the town of Digne after nineteen years in the galleys.',
        startPageNumber: 1,
        pageCount: 1,
      },
    ];

    const res = searchInBook(accentedChapters, 'valjean');
    expect(res.totalMatches).toBe(1);
    expect(res.matches[0].snippetBefore).toContain('Jean ');
  });

  it('caps matches to maxResults limit', () => {
    const repetitiveChapters: ChapterSection[] = [
      {
        id: 1,
        title: 'CHAPTER I',
        displayTitle: 'Chapter I',
        content: 'word '.repeat(200),
        startPageNumber: 1,
        pageCount: 1,
      },
    ];

    const res = searchInBook(repetitiveChapters, 'word', 18, 5);
    expect(res.totalMatches).toBe(5);
    expect(res.matches).toHaveLength(5);
  });

  it('safely skips chapters with null or empty content', () => {
    const mixedChapters: ChapterSection[] = [
      {
        id: 1,
        title: 'EMPTY',
        displayTitle: 'Empty Chapter',
        content: '',
        startPageNumber: 1,
        pageCount: 1,
      },
      {
        id: 2,
        title: 'VALID',
        displayTitle: 'Valid Chapter',
        content: 'Valid content with target term.',
        startPageNumber: 2,
        pageCount: 1,
      },
    ];

    const res = searchInBook(mixedChapters, 'target');
    expect(res.totalMatches).toBe(1);
    expect(res.matches[0].chapterIndex).toBe(1);
  });

  it('caps matches to maxResults when using diacritic fallback', () => {
    const accentedChapters: ChapterSection[] = [
      {
        id: 1,
        title: 'CHAPTER I',
        displayTitle: 'Chapter I',
        content: 'Crème brûlée '.repeat(10),
        startPageNumber: 1,
        pageCount: 1,
      },
    ];

    const res = searchInBook(accentedChapters, 'creme', 18, 1);
    expect(res.totalMatches).toBe(1);
    expect(res.matches).toHaveLength(1);
  });
});
