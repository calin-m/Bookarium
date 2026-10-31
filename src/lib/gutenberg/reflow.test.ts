// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { formatGutenbergTypography, reflowGutenbergParagraphs } from './reflow';

describe('reflowGutenbergParagraphs & formatGutenbergTypography', () => {
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

  it('preserves alternating-indent poetry and unindented short-line stanzas while unwrapping 70-column hanging-indent dramatic prose speeches', () => {
    const alternatingPoem = `Tiger, tiger, burning bright
  In the forests of the night,
What immortal hand or eye
  Could frame thy fearful symmetry?`;

    expect(reflowGutenbergParagraphs(alternatingPoem)).toBe(alternatingPoem);

    const shortStanza = `In Xanadu did Kubla Khan
A stately pleasure-dome decree:
Where Alph, the sacred river, ran
Through caverns measureless to man`;

    expect(reflowGutenbergParagraphs(shortStanza)).toBe(shortStanza);

    // 70-column hanging-indent dramatic speech in a play must unwrap cleanly for mobile screens
    const dramaticSpeech = `ALGERNON. I really don't see anything romantic in proposing. It is very
  romantic to be in love. But there is nothing romantic about a definite
  proposal. Why, one may be accepted. One usually is, I believe.`;

    expect(reflowGutenbergParagraphs(dramaticSpeech)).toBe(
      "ALGERNON. I really don't see anything romantic in proposing. It is very romantic to be in love. But there is nothing romantic about a definite proposal. Why, one may be accepted. One usually is, I believe."
    );
  });

  it('converts 2-hyphen prose dashes to em-dashes and strips _italic_ wrappers while preserving Victorian redacted blanks, snake_case, and ASCII tables', () => {
    expect(
      formatGutenbergTypography(
        'Some years ago--never mind how long _precisely_--having _very little_ money.'
      )
    ).toBe('Some years ago—never mind how long precisely—having very little money.');

    // Preserves censored Victorian blanks and snake_case identifiers
    expect(
      formatGutenbergTypography(
        'Captain ____ of the ____ Regiment arrived in 17__ with snake_case_token intact.'
      )
    ).toBe('Captain ____ of the ____ Regiment arrived in 17__ with snake_case_token intact.');

    // Preserves scene breaks and ASCII table borders
    expect(formatGutenbergTypography('* * *')).toBe('* * *');
    expect(formatGutenbergTypography('-----')).toBe('-----');
    expect(formatGutenbergTypography('+--+--+')).toBe('+--+--+');
    expect(formatGutenbergTypography('')).toBe('');
  });
});

