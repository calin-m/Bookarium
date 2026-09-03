import { describe, it, expect } from 'vitest';
import { reflowGutenbergParagraphs } from './reflow';

describe('reflowGutenbergParagraphs', () => {
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

  it('reflows standard Gutenberg paragraphs that have 4-space first-line indentation', () => {
    const indentedParagraph = `    Alice was beginning to get very tired of sitting by her sister
on the bank, and of having nothing to do: once or twice she had
peeped into the book her sister was reading.`;

    const expected = `Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: once or twice she had peeped into the book her sister was reading.`;

    expect(reflowGutenbergParagraphs(indentedParagraph)).toBe(expected);
  });

  it('preserves indented verse and poetry lines during reflow', () => {
    const poem = `    The sea! the sea! the open sea!
    The blue, the fresh, the ever free!
    Without a mark, without a bound,
    It runneth the earth's wide regions round;`;

    expect(reflowGutenbergParagraphs(poem)).toBe(poem);
  });
});

