// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  extractDynamicBookPassages,
  formatCleanQuote,
  resolveSpreadQuoteLayout,
} from './passages';

describe('passages subsystem', () => {
  it('returns empty array on empty or invalid text', () => {
    expect(extractDynamicBookPassages('', { id: 1, title: 'Sample' })).toEqual([]);
    expect(extractDynamicBookPassages(null, { id: 1, title: 'Sample' })).toEqual([]);
    expect(extractDynamicBookPassages('short text', { id: 1, title: 'Sample' })).toEqual([]);
  });

  it('extracts opening lines and authentic quote passages from full book text', () => {
    const sampleBookText = `
The Project Gutenberg eBook of The Time Machine, by H. G. Wells

*** START OF THE PROJECT GUTENBERG EBOOK THE TIME MACHINE ***

CHAPTER I

The Time Traveller (for so it will be convenient to speak of him) was expounding a recondite matter to us. His grey eyes shone and twinkled, and his usually pale face was flushed and animated.

"You must follow me carefully. I shall have to controvert one or two ideas that are almost universally accepted."

"The geometry, for instance, they taught you at school is founded on a misconception."

"Is not a point having no dimensions—that is, having no length, breadth, or thickness?"

CHAPTER II

"It is simply this. That Space, as our mathematicians have it, is spoken of as having three dimensions."

"Can a cube that does not last for any time at all, have a real existence?"

"Clearly," the Time Traveller proceeded, "any real body must have extension in four directions: it must have Length, Breadth, Thickness, and—Duration."

*** END OF THE PROJECT GUTENBERG EBOOK THE TIME MACHINE ***
`;

    const passages = extractDynamicBookPassages(sampleBookText, {
      id: 35,
      title: 'The Time Machine',
      authors: [{ name: 'Wells, H. G.' }],
      subjects: ['Science Fiction'],
    });

    expect(passages.length).toBeGreaterThanOrEqual(1);
    expect(passages[0].openingLine).toContain('The Time Traveller');
    expect(passages[0].secondaryQuote).toBeDefined();
    expect(passages[0].quoteExcerpt).toBeDefined();
    expect(passages[0].commentary).toContain('ID #35');
  });

  it('extracts passages from a 5-chapter book across narrative arc', () => {
    const fiveChapterBook = `
*** START OF THE PROJECT GUTENBERG EBOOK EPIC ***
CHAPTER I
First chapter narrative text begins here with rich words.
"This is quote number one from chapter one of the volume."

CHAPTER II
Second chapter narrative follows with continuing adventures.
"This is quote number two from the second chapter."

CHAPTER III
Third chapter expands the story and the quest across mountains.
"Here is the third quote from the expanding journey."

CHAPTER IV
Fourth chapter reaches the mid-point climax of the epic battle.
"Behold the climactic turning point of the adventure."

CHAPTER V
Fifth and final chapter brings resolution and conclusion to all.
"We have reached the end of the journey in peace."
*** END OF THE PROJECT GUTENBERG EBOOK EPIC ***
`;

    const passages = extractDynamicBookPassages(fiveChapterBook, {
      id: 100,
      title: 'Epic Adventure',
      authors: [{ name: 'Author, Epic' }],
      subjects: ['Adventure'],
    });

    expect(passages.length).toBe(5);
    expect(passages[0].chapterLabel).toContain('Chapter I');
    expect(passages[1].chapterLabel).toContain('Chapter II');
    expect(passages[2].chapterLabel).toContain('Act II');
    expect(passages[3].chapterLabel).toContain('Climax');
    expect(passages[4].chapterLabel).toContain('Final Chapter');
  });

  it('extracts passages from a 3-chapter and 2-chapter book', () => {
    const threeChapterBook = `
*** START OF THE PROJECT GUTENBERG EBOOK THREE ***
CHAPTER I
Chapter 1 text with dialogue. "Here is dialogue in chapter 1."
CHAPTER II
Chapter 2 text with dialogue. "Here is dialogue in chapter 2."
CHAPTER III
Chapter 3 text with dialogue. "Here is dialogue in chapter 3."
*** END OF THE PROJECT GUTENBERG EBOOK THREE ***
`;
    const passages3 = extractDynamicBookPassages(threeChapterBook, { id: 3, title: 'Three' });
    expect(passages3.length).toBe(3);

    const twoChapterBook = `
*** START OF THE PROJECT GUTENBERG EBOOK TWO ***
CHAPTER I
Chapter 1 text with dialogue. "Here is dialogue in chapter 1."
CHAPTER II
Chapter 2 text with dialogue. "Here is dialogue in chapter 2."
*** END OF THE PROJECT GUTENBERG EBOOK TWO ***
`;
    const passages2 = extractDynamicBookPassages(twoChapterBook, { id: 2, title: 'Two' });
    expect(passages2.length).toBe(3);
  });

  it('extracts passages from a single-chapter un-segmented text by paragraph chunks', () => {
    const singleChapterBook = `
*** START OF THE PROJECT GUTENBERG EBOOK SINGLE ***
Paragraph one begins the entire single volume story with details.
"Here is the first quote in the single text."

Paragraph two continues the account across many paragraphs.
"Here is the second quote in the single text."

Paragraph three brings the story towards the middle section.
"Here is the third quote in the single text."

Paragraph four brings the narrative towards its final moments.
"Here is the final concluding quote of the volume."
*** END OF THE PROJECT GUTENBERG EBOOK SINGLE ***
`;
    const passages = extractDynamicBookPassages(singleChapterBook, { id: 1, title: 'Single' });
    expect(passages.length).toBe(3);
    expect(passages[0].chapterLabel).toContain('Chapter I');
    expect(passages[1].chapterLabel).toContain('Act II');
    expect(passages[2].chapterLabel).toContain('Act III');
  });

  it('filters out Distributed Proofreading and Transcriber boilerplate in Newest Releases', () => {
    const newestReleaseText = `
*** START OF THE PROJECT GUTENBERG EBOOK NEWEST RELEASE ***

Produced by Greg Weeks and the Online Distributed Proofreading Team at https://www.pgdp.net

Transcriber's Note: Extensive research found no evidence that the copyright was renewed.

[Illustration: Frontispiece portrait of the author in 1910]

CHAPTER I

The real narrative begins with genuine prose and storytelling after the front matter.
"Here is the authentic dialogue spoken by the characters in chapter one."

CHAPTER II

Continuing the adventure into the next chapter with excitement.
"Here is another authentic quote from the subsequent events."

*** END OF THE PROJECT GUTENBERG EBOOK NEWEST RELEASE ***
`;
    const passages = extractDynamicBookPassages(newestReleaseText, {
      id: 74500,
      title: 'Newest Release Volume',
      authors: [{ name: 'Modern Contributor' }],
    });

    expect(passages.length).toBeGreaterThanOrEqual(1);
    expect(passages[0].openingLine).not.toContain('Distributed Proofreading');
    expect(passages[0].openingLine).not.toContain('Transcriber');
    expect(passages[0].openingLine).not.toContain('Illustration');
    expect(passages[0].openingLine).toContain('The real narrative begins');
    expect(passages[0].quoteExcerpt).toContain('authentic dialogue');
  });

  it('does not duplicate opening line into secondary or tertiary quotes on short chapters', () => {
    const shortChapterText = `
*** START OF THE PROJECT GUTENBERG EBOOK SHORT ***
CHAPTER I
Only a single paragraph exists in this concise chapter for test purposes.
*** END OF THE PROJECT GUTENBERG EBOOK SHORT ***
`;
    const passages = extractDynamicBookPassages(shortChapterText, {
      id: 999,
      title: 'Short Chapter Volume',
    });

    expect(passages.length).toBeGreaterThanOrEqual(1);
    expect(passages[0].openingLine).toContain('Only a single paragraph exists');
    // Secondary, left2, right2, and tertiary should NOT be duplicates of openingLine
    expect(passages[0].secondaryQuote).toBeUndefined();
    expect(passages[0].leftPageQuote2).toBeUndefined();
    expect(passages[0].rightPageQuote2).toBeUndefined();
    expect(passages[0].tertiaryQuote).toBeUndefined();
  });

  it('filters out ASCII divider rules, framed copyright colophons, and underscore blank lines (reproducing book #79835)', () => {
    const freudBookText = `
The Project Gutenberg eBook of Inhibition, Symptom and Anxiety, by Sigmund Freud

*** START OF THE PROJECT GUTENBERG EBOOK INHIBITION, SYMPTOM AND ANXIETY ***

------------------------------------------------------------------------
                             Copyright 1927
                    By The Psychoanalytic Institute
------------------------------------------------------------------------

________________________________________________________________________

"_____________________"

CHAPTER I

------------------------------------------------------------------------ Copyright 1927 ------------------------------------------------------------------------

_____________________

In the consideration of symptoms and inhibitions we are led to examine the nature of mental conflict and defense mechanisms.

"The ego is the actual seat of anxiety; it perceives danger and initiates the defensive reaction."

"A symptom is a sign of, and a substitute for, an instinctual satisfaction which has remained in abeyance."

________________________________________________________________________
Footnotes:
[1] See Introductory Lectures on Psychoanalysis, 1916.

CHAPTER II

Defense against instinctual demands creates the clinical picture of neurosis in human experience. The symptom is born of the struggle between the ego and the repressed wishes that continually strive for consciousness and active expression.

"Anxiety is a reaction to a situation of danger, and it is obviated by the ego doing something to avoid it."

*** END OF THE PROJECT GUTENBERG EBOOK INHIBITION, SYMPTOM AND ANXIETY ***
`;

    const passages = extractDynamicBookPassages(freudBookText, {
      id: 79835,
      title: 'Inhibition, Symptom and Anxiety',
      authors: [{ name: 'Freud, Sigmund' }],
      subjects: ['Psychoanalysis'],
    });

    expect(passages.length).toBeGreaterThanOrEqual(1);

    // Verify none of the passage fields contain divider rules, copyright colophons, or underscore blanks
    for (const p of passages) {
      expect(p.openingLine).not.toContain('Copyright 1927');
      expect(p.openingLine).not.toContain('----------------');
      expect(p.openingLine).not.toContain('________________');
      expect(p.openingLine).not.toContain('____');

      expect(p.quoteExcerpt).not.toContain('Copyright 1927');
      expect(p.quoteExcerpt).not.toContain('----------------');
      expect(p.quoteExcerpt).not.toContain('________________');

      if (p.secondaryQuote) {
        expect(p.secondaryQuote).not.toContain('Copyright 1927');
        expect(p.secondaryQuote).not.toContain('----------------');
        expect(p.secondaryQuote).not.toContain('________________');
      }
    }

    // Verify that genuine prose from Freud's work is extracted
    expect(passages[0].openingLine).toContain('In the consideration of symptoms and inhibitions');
    expect(passages[0].quoteExcerpt).toContain('The ego is the actual seat of anxiety');
    expect(passages[0].secondaryQuote).toContain('A symptom is a sign of');
  });

  it('rejects quoted blanks and horizontal dividers in unsegmented single-text books', () => {
    const singleBookWithArtifacts = `
*** START OF THE PROJECT GUTENBERG EBOOK DIVIDERS ***

------------------------------------------------------------------------
Copyright 1925 by Academic Publishing Group. All rights reserved.
------------------------------------------------------------------------

________________________________________________________________________

"_____________________"

The beginning of the narrative begins with thoughtful observations upon human society and natural history.

"Real dialogue is spoken by real people who discuss genuine philosophical questions."

"Another authentic quote containing sufficient words and wisdom to be shared."

________________________________________________________________________
[Footnote 1: Citations and historical references]

*** END OF THE PROJECT GUTENBERG EBOOK DIVIDERS ***
`;

    const passages = extractDynamicBookPassages(singleBookWithArtifacts, {
      id: 79999,
      title: 'Philosophical Discourse',
    });

    expect(passages.length).toBeGreaterThanOrEqual(1);
    for (const p of passages) {
      expect(p.openingLine).not.toContain('----------------');
      expect(p.openingLine).not.toContain('________________');
      expect(p.openingLine).not.toContain('Copyright 1925');
      expect(p.quoteExcerpt).not.toContain('----------------');
      expect(p.quoteExcerpt).not.toContain('________________');
      expect(p.quoteExcerpt).not.toContain('Copyright 1925');
    }
    expect(passages[0].openingLine).toContain('The beginning of the narrative begins');
    expect(passages[1].openingLine).toContain('Real dialogue is spoken');
    expect(passages[2].openingLine).toContain('Another authentic quote');
  });

  it('extracts up to maxPassages (10–16) spreads when maxPassages > 5 across multi-chapter and compact books', () => {
    const twelveChapterText = Array.from({ length: 12 }, (_, idx) => {
      const chNum = idx + 1;
      return [
        `CHAPTER ${chNum}`,
        `Narrative opening paragraph for chapter number ${chNum} with rich prose and literary detail.`,
        `"Dialogue quote one inside chapter number ${chNum} spoken with great conviction and clarity."`,
        `"Dialogue quote two inside chapter number ${chNum} answering the philosophical inquiry."`,
      ].join('\n\n');
    }).join('\n\n');

    const twelvePassages = extractDynamicBookPassages(
      twelveChapterText,
      { id: 1342, title: 'Pride and Prejudice' },
      12
    );
    expect(twelvePassages).toHaveLength(12);
    expect(twelvePassages[0].chapterLabel).toContain('Passage 1');

    const compactTwoChapterManyParas = [
      'CHAPTER I',
      ...Array.from(
        { length: 24 },
        (_, idx) =>
          `Paragraph number ${idx + 1} with extended literary narrative and reflection. "Spoken quote number ${idx + 1} inside the volume."`
      ),
      'CHAPTER II',
      ...Array.from(
        { length: 24 },
        (_, idx) =>
          `Second chapter paragraph ${idx + 1} continuing the classic tale across the sea. "Dialogue line ${idx + 1} in chapter two."`
      ),
    ].join('\n\n');

    const tenPassages = extractDynamicBookPassages(
      compactTwoChapterManyParas,
      { id: 84, title: 'Frankenstein' },
      10
    );
    expect(tenPassages.length).toBeGreaterThanOrEqual(6);
    expect(tenPassages.length).toBeLessThanOrEqual(10);
  });

  it('truncates long passages cleanly at sentence boundaries or whole-word boundaries without splitting words in half', () => {
    const longSentenceText = `
*** START OF THE PROJECT GUTENBERG EBOOK BOUNDARIES ***
CHAPTER I

It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife. However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families, that he is considered the rightful property of some one or other of their daughters.

"When a single long clause continues without any terminal period across more than two hundred characters because the speaker elaborates continuously upon philosophical matters and metaphysical abstractions and extraordinary contemplations of universal harmony, the extractor must cut cleanly on a whole word boundary."

Another narrative paragraph follows in the chapter to provide sufficient structural depth for multi-paragraph slice extraction across the volume.

A fourth narrative paragraph continues the chapter discussion with clear observations about the surrounding countryside and its inhabitants.

A fifth narrative paragraph describes the arrival of the autumn season and the preparations made across the old estate.

A sixth narrative paragraph concludes the opening chapter with reflections upon human nature and social custom.
*** END OF THE PROJECT GUTENBERG EBOOK BOUNDARIES ***
`;

    const passages = extractDynamicBookPassages(longSentenceText, {
      id: 1342,
      title: 'Boundary Test',
    });

    expect(passages.length).toBeGreaterThanOrEqual(1);
    // First paragraph has a natural sentence end at index ~117 ("...in want of a wife.") within the 220-char budget
    expect(passages[0].openingLine).toBe(
      '“It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.”'
    );
    // Second paragraph has no sentence boundary before 220 chars, so it must cut at a whole word + ellipsis
    expect(passages[0].quoteExcerpt).toMatch(/…”$/);
    expect(passages[0].quoteExcerpt).not.toMatch(/philoso…”|extraor…”/);
  });

  it('dynamically packs left, right, and cover quotes within line budgets, promotes shorter tertiary candidates, and deduplicates across pages', () => {
    expect(formatCleanQuote('“Hello world”')).toBe('Hello world');
    expect(formatCleanQuote(undefined)).toBe('');

    // 1. Concise 3-quote spread on both pages
    const conciseLayout = resolveSpreadQuoteLayout(
      {
        openingLine: '“First short left quote.”',
        secondaryQuote: '“Second short left quote.”',
        leftPageQuote2: '“Third short left quote.”',
        quoteExcerpt: '“First short right quote.”',
        rightPageQuote2: '“Second short right quote.”',
        tertiaryQuote: '“Third short right quote.”',
      },
      { title: 'Poems', cardHeight: 480 }
    );
    expect(conciseLayout.leftQuotes).toHaveLength(3);
    expect(conciseLayout.rightQuotes).toHaveLength(3);
    expect(conciseLayout.leftLineClampClass).toBe('line-clamp-3 sm:line-clamp-4');
    expect(conciseLayout.rightLineClampClass).toBe('line-clamp-3 sm:line-clamp-4');
    expect(conciseLayout.coverQuote).toBe('First short right quote.');
    expect(conciseLayout.coverLineClampClass).toBe('line-clamp-5');

    // 2. Smart promotion: when slot 2 is too long to fit alongside a long slot 1, a concise slot 3 is promoted into slot 2
    const promotedLayout = resolveSpreadQuoteLayout(
      {
        openingLine: 'A'.repeat(210), // 6 lines
        secondaryQuote: 'B'.repeat(240), // 6 lines (+ 1.5 box = 13.5 > 9.5 left budget under very long title)
        leftPageQuote2: 'Concise promoted left quote.', // 1 line (+ 1.5 box = 8.5 <= 9.5)
        quoteExcerpt: 'C'.repeat(220), // 6 lines
        rightPageQuote2: 'D'.repeat(250), // 7 lines (+ 1.5 box = 14.5 > 12.0 right budget)
        tertiaryQuote: 'Concise promoted right quote.', // 1 line (+ 1.5 box = 8.5 <= 12.0)
      },
      {
        title: 'An Extraordinarily Long Nineteenth-Century Philosophical Treatise Title',
        hasCommentary: true,
        cardHeight: 480,
      }
    );
    expect(promotedLayout.leftQuotes).toEqual(['A'.repeat(210), 'Concise promoted left quote.']);
    expect(promotedLayout.rightQuotes).toEqual(['C'.repeat(220), 'Concise promoted right quote.']);
    expect(promotedLayout.leftLineClampClass).toBe('line-clamp-6 sm:line-clamp-7');
    expect(promotedLayout.rightLineClampClass).toBe('line-clamp-6 sm:line-clamp-7');
    // Cover quote selects the first candidate <= 130 chars under a long (>40 chars) title
    expect(promotedLayout.coverQuote).toBe('Concise promoted right quote.');
    expect(promotedLayout.coverLineClampClass).toBe('line-clamp-4');

    // 3. Cross-page deduplication & fallback when all right-page quotes duplicate left-page quotes
    const duplicateSpread = resolveSpreadQuoteLayout(
      {
        openingLine: 'Identical passage across both pages.',
        quoteExcerpt: 'Identical passage across both pages.',
      },
      { title: 'Short Title', hasContentAdvisory: true }
    );
    expect(duplicateSpread.leftQuotes).toEqual(['Identical passage across both pages.']);
    expect(duplicateSpread.rightQuotes).toEqual(['Identical passage across both pages.']);
    expect(duplicateSpread.leftLineClampClass).toBe('line-clamp-8 sm:line-clamp-9');
  });
});

