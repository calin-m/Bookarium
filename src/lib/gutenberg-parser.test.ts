import { describe, it, expect } from 'vitest';
import {
  parseGutenbergChapters,
  calculateReadingTime,
  calculateVolumePageSpread,
  getCharsPerPage,
  reflowGutenbergParagraphs,
} from './gutenberg-parser';

describe('src/lib/gutenberg-parser', () => {
  it('returns empty array on null or undefined input', () => {
    expect(parseGutenbergChapters(null)).toEqual([]);
    expect(parseGutenbergChapters(undefined)).toEqual([]);
    expect(parseGutenbergChapters('')).toEqual([]);
  });

  it('correctly calculates reading time based on 200 WPM', () => {
    const text = new Array(400).fill('word').join(' ');
    expect(calculateReadingTime(text)).toBe(2);
  });

  it('reflows single-newline Gutenberg hard wraps while preserving double newlines', () => {
    const rawParagraph = `Call me Ishmael. Some years ago—never mind how long
precisely—having little or no money in my purse, and
nothing particular to interest me on shore.

There now is your insular city of the Manhattoes, belted
round by wharves as Indian isles by coral reefs.`;

    const expected = `Call me Ishmael. Some years ago—never mind how long precisely—having little or no money in my purse, and nothing particular to interest me on shore.

There now is your insular city of the Manhattoes, belted round by wharves as Indian isles by coral reefs.`;

    expect(reflowGutenbergParagraphs(rawParagraph)).toBe(expected);
    expect(reflowGutenbergParagraphs('')).toBe('');
    expect(reflowGutenbergParagraphs(null)).toBe('');
  });

  it('preserves indented verse and poetry lines during reflow', () => {
    const poem = `    The sea! the sea! the open sea!
    The blue, the fresh, the ever free!
    Without a mark, without a bound,
    It runneth the earth's wide regions round;`;

    expect(reflowGutenbergParagraphs(poem)).toBe(poem);
  });

  it('calculates dynamic characters per page scaled by font size', () => {
    expect(getCharsPerPage(18)).toBe(5600);
    expect(getCharsPerPage(36)).toBe(2800);
    expect(getCharsPerPage(72)).toBe(1400);
    expect(getCharsPerPage(100)).toBe(1200); // Clamped to min 1200
  });

  it('parses structured Project Gutenberg eBook into preamble, chapters, and license colophon', () => {
    const sampleBook = `
*** START OF THE PROJECT GUTENBERG EBOOK PRIDE AND PREJUDICE ***

PRIDE AND PREJUDICE
By Jane Austen

CHAPTER 1

It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.

CHAPTER 2

Mr. Bennet was among the earliest of those who waited on Mr. Bingley.

*** END OF THE PROJECT GUTENBERG EBOOK PRIDE AND PREJUDICE ***

End of Gutenberg License terms.
`;

    const chapters = parseGutenbergChapters(sampleBook);
    expect(chapters.length).toBeGreaterThanOrEqual(3);

    expect(chapters[0].title).toBe('Title & Preamble');
    expect(chapters[0].content).toContain('PRIDE AND PREJUDICE');

    const ch1 = chapters.find((c) => c.title.includes('CHAPTER 1'));
    expect(ch1).toBeDefined();
    expect(ch1?.content).toContain('It is a truth universally acknowledged');

    const ch2 = chapters.find((c) => c.title.includes('CHAPTER 2'));
    expect(ch2).toBeDefined();
    expect(ch2?.content).toContain('Mr. Bennet was among the earliest');

    const colophon = chapters[chapters.length - 1];
    expect(colophon.title).toContain('Colophon');
    expect(colophon.content).toContain('End of Gutenberg License');
  });

  it('suppresses front-matter Table of Contents cluster lines from becoming empty duplicate chapters', () => {
    const textWithToc = `
*** START OF THIS PROJECT GUTENBERG EBOOK MOBY DICK ***

MOBY DICK; OR, THE WHALE
By Herman Melville

TABLE OF CONTENTS

CHAPTER 1 Loomings
CHAPTER 2 The Carpet-Bag
CHAPTER 3 The Spouter-Inn

CHAPTER 1 Loomings
Call me Ishmael. Some years ago... ${'content '.repeat(100)}

CHAPTER 2 The Carpet-Bag
I stuffed a shirt or two into my old bag... ${'content '.repeat(100)}

*** END OF THIS PROJECT GUTENBERG EBOOK MOBY DICK ***
`;

    const chapters = parseGutenbergChapters(textWithToc);
    const ch1Instances = chapters.filter((c) => c.title.includes('CHAPTER 1'));
    // The TOC item is suppressed; only the actual full chapter is retained
    expect(ch1Instances.length).toBe(1);
    expect(ch1Instances[0].content).toContain('Call me Ishmael');
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

  it('falls back cleanly to Complete Volume for unformatted single-block text', () => {
    const unformatted = 'Short standalone essay with no chapters.';
    const chapters = parseGutenbergChapters(unformatted);
    expect(chapters.length).toBe(1);
    expect(chapters[0].title).toBe('Complete Volume');
    expect(chapters[0].content).toBe(unformatted);
  });
});

