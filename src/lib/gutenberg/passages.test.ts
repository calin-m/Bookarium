import { describe, it, expect } from 'vitest';
import { extractDynamicBookPassages } from './passages';

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
});

