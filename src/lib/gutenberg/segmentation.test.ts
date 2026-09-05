import { describe, it, expect } from 'vitest';
import { parseGutenbergChapters } from './segmentation';

describe('segmentation subsystem', () => {
  it('returns empty array on null or undefined input', () => {
    expect(parseGutenbergChapters(null)).toEqual([]);
    expect(parseGutenbergChapters(undefined)).toEqual([]);
    expect(parseGutenbergChapters('')).toEqual([]);
  });

  it('falls back cleanly to Complete Volume for unformatted single-block text', () => {
    const unformatted = 'Short standalone essay with no chapters.';
    const chapters = parseGutenbergChapters(unformatted);
    expect(chapters.length).toBe(1);
    expect(chapters[0].title).toBe('Complete Volume');
    expect(chapters[0].content).toBe(unformatted);
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

  it('parses short story anthologies with front-matter CONTENTS lists into individual story sections', () => {
    const anthologyText = `
*** START OF THE PROJECT GUTENBERG EBOOK GHOST STORIES ***

Twenty-Five Ghost Stories

CONTENTS.

                                                                    PAGE
Preface                                                                5
The Black Cat                                                          7
The Flayed Hand                                                       28
The Vengeance of a Tree                                               37

PREFACE

This collection of ghost stories owes its publication to an interest...

THE BLACK CAT.
BY EDGAR ALLAN POE.

For the most wild, yet most homely narrative which I am about to pen...

THE FLAYED HAND.
BY GUY DE MAUPASSANT.

One evening about eight months ago I met with some college comrades...

THE VENGEANCE OF A TREE.
BY ELEANOR F. LEWIS.

All draped with blue denim was the room...

*** END OF THE PROJECT GUTENBERG EBOOK GHOST STORIES ***
`;

    const sections = parseGutenbergChapters(anthologyText);
    expect(sections.length).toBeGreaterThanOrEqual(4);

    const blackCat = sections.find((s) => s.title.includes('The Black Cat'));
    expect(blackCat).toBeDefined();
    expect(blackCat?.content).toContain('For the most wild, yet most homely narrative');

    const flayedHand = sections.find((s) => s.title.includes('The Flayed Hand'));
    expect(flayedHand).toBeDefined();
    expect(flayedHand?.content).toContain('One evening about eight months ago');

    const tree = sections.find((s) => s.title.includes('The Vengeance of a Tree'));
    expect(tree).toBeDefined();
    expect(tree?.content).toContain('All draped with blue denim');
  });

  it('parses books formatted with standalone Roman numerals (such as The Great Gatsby)', () => {
    const romanNumeralBook = `
*** START OF THE PROJECT GUTENBERG EBOOK THE GREAT GATSBY ***

Table of Contents
I
II
III

I

In my younger and more vulnerable years my father gave me some advice that I have been turning over in my mind ever since.

II

About half way between West Egg and New York the motorroad hastily joins the railroad.

III

There was music from my neighbor's house through the summer nights.

*** END OF THE PROJECT GUTENBERG EBOOK THE GREAT GATSBY ***
`;
    const chapters = parseGutenbergChapters(romanNumeralBook);
    expect(chapters.length).toBeGreaterThanOrEqual(4); // Preamble + I, II, III

    const ch1 = chapters.find((c) => c.displayTitle === 'Chapter I' || c.title === 'I');
    expect(ch1).toBeDefined();
    expect(ch1?.displayTitle).toBe('Chapter I');
    expect(ch1?.content).toContain('In my younger and more vulnerable years');

    const ch2 = chapters.find((c) => c.displayTitle === 'Chapter II' || c.title === 'II');
    expect(ch2).toBeDefined();
    expect(ch2?.displayTitle).toBe('Chapter II');
    expect(ch2?.content).toContain('West Egg');
  });

  it('parses multi-work anthologies with standalone titles and footnote brackets (e.g. Book 831 Four Arthurian Romances)', () => {
    const anthologyText = `
*** START OF THE PROJECT GUTENBERG EBOOK FOUR ARTHURIAN ROMANCES ***

FOUR ARTHURIAN ROMANCES:
"EREC ET ENIDE", "CLIGÉS", "YVAIN", AND "LANCELOT"

by Chrétien de Troyes

SELECTED BIBLIOGRAPHY:
ORIGINAL TEXT--
Carroll, Carleton W. (Ed.): "Chrétien DeTroyes"

INTRODUCTION

Chrétien de Troyes has had the peculiar fortune of remaining practically unknown to any one else.

${'A'.repeat(1200)}

EREC ET ENIDE [11]

The rustic's proverb says that many a thing is despised that is worth much more than is supposed.

${'B'.repeat(1200)}

CLIGÉS [21]

He who wrote of Erec and Enide, and translated into French the commands of Ovid.

${'C'.repeat(1200)}

YVAIN

Arthur, the good King of Britain, whose prowess teaches us to be hardy and courteous.

${'D'.repeat(1200)}

LANCELOT

Since my lady of Champagne wishes me to undertake the writing of a romance.

${'E'.repeat(1200)}

*** END OF THE PROJECT GUTENBERG EBOOK FOUR ARTHURIAN ROMANCES ***
`;

    const chapters = parseGutenbergChapters(anthologyText);
    expect(chapters.length).toBeGreaterThanOrEqual(5);

    const intro = chapters.find((c) => c.displayTitle.includes('Introduction'));
    expect(intro).toBeDefined();

    const erec = chapters.find((c) => c.displayTitle.includes('Erec et Enide'));
    expect(erec).toBeDefined();
    expect(erec?.title).toBe('EREC ET ENIDE');
    expect(erec?.displayTitle).toBe('Erec et Enide');
    expect(erec?.content).toContain("The rustic's proverb");

    const cliges = chapters.find((c) => c.displayTitle.includes('Cligés'));
    expect(cliges).toBeDefined();

    const yvain = chapters.find((c) => c.displayTitle.includes('Yvain'));
    expect(yvain).toBeDefined();

    const lancelot = chapters.find((c) => c.displayTitle.includes('Lancelot'));
    expect(lancelot).toBeDefined();
  });

  it('parses complex TOC without catastrophic backtracking or thread lock', () => {
    const complexText = `
TABLE OF CONTENTS
Chapter I. The Beginning ................. 1
Chapter II. The Middle ................... 25
Chapter III. The Resolution .............. 50

${'A'.repeat(50000)}
`;
    const start = Date.now();
    const chapters = parseGutenbergChapters(complexText);
    const elapsed = Date.now() - start;

    expect(chapters).toBeDefined();
    expect(elapsed).toBeLessThan(100); // Must parse in < 100ms
  });

  it('parses books formatted with dotted Roman numerals and subtitle lines (such as The Time Machine)', () => {
    const timeMachineText = `
*** START OF THE PROJECT GUTENBERG EBOOK THE TIME MACHINE ***

THE TIME MACHINE
By H. G. Wells

 I.
 Introduction

The Time Traveller (for so it will be convenient to speak of him) was expounding a recondite matter to us.

 II.
 The Machine

It is simply this. That Space, as our mathematicians have it, is spoken of as having three dimensions.

 III.
 The Time Traveller Returns

I think that at that time none of us quite believed in the Time Machine.

*** END OF THE PROJECT GUTENBERG EBOOK THE TIME MACHINE ***
`;
    const chapters = parseGutenbergChapters(timeMachineText);
    expect(chapters.length).toBeGreaterThanOrEqual(4); // Preamble + 3 Chapters + Colophon

    const ch1 = chapters.find((c) => c.displayTitle.includes('Chapter I: Introduction'));
    expect(ch1).toBeDefined();
    expect(ch1?.content).toContain('The Time Traveller');

    const ch2 = chapters.find((c) => c.displayTitle.includes('Chapter II: The Machine'));
    expect(ch2).toBeDefined();
    expect(ch2?.content).toContain('our mathematicians have it');

    const ch3 = chapters.find((c) => c.displayTitle.includes('Chapter III: The Time Traveller Returns'));
    expect(ch3).toBeDefined();
    expect(ch3?.content).toContain('none of us quite believed');
  });

  it('suppresses single-digit front-matter TOC items with subtitles and enriches body chapter titles (such as Jules Verne)', () => {
    const verneStyleText = `
*** START OF THE PROJECT GUTENBERG EBOOK A JOURNEY TO THE CENTRE OF THE EARTH ***

A JOURNEY TO THE CENTRE OF THE EARTH
By Jules Verne

TABLE OF CONTENTS

CHAPTER 1 MY UNCLE MAKES A GREAT DISCOVERY
CHAPTER 2 THE MYSTERIOUS PARCHMENT
CHAPTER 10 THE SPECULATION

CHAPTER 1

Looking back to all that has occurred to me since that eventful day... ${'content '.repeat(100)}

CHAPTER 2

This momentous book was in my hands... ${'content '.repeat(100)}

CHAPTER 10

It ought, one would have thought, to have been night... ${'content '.repeat(100)}

*** END OF THE PROJECT GUTENBERG EBOOK A JOURNEY TO THE CENTRE OF THE EARTH ***
`;

    const chapters = parseGutenbergChapters(verneStyleText);

    // Should only have Title & Preamble + 3 authentic Chapters + Colophon = 5 sections (ZERO ghost TOC chapters)
    expect(chapters.length).toBe(5);

    const ch1 = chapters.find((c) => c.title === 'CHAPTER 1');
    expect(ch1).toBeDefined();
    expect(ch1?.content).toContain('Looking back to all that has occurred');
    // Subtitle harvested from TOC line should be transferred and formatted
    expect(ch1?.displayTitle).toBe('Chapter 1: My Uncle Makes a Great Discovery');

    const ch2 = chapters.find((c) => c.title === 'CHAPTER 2');
    expect(ch2).toBeDefined();
    expect(ch2?.displayTitle).toBe('Chapter 2: The Mysterious Parchment');

    const ch10 = chapters.find((c) => c.title === 'CHAPTER 10');
    expect(ch10).toBeDefined();
    expect(ch10?.displayTitle).toBe('Chapter 10: The Speculation');
  });

  it('preserves repeated chapter numbers across multi-part books', () => {
    const multiPartBook = `
*** START OF THE PROJECT GUTENBERG EBOOK WAR AND PEACE ***

PART 1

CHAPTER 1

First part, first chapter content... ${'content '.repeat(100)}

CHAPTER 2

First part, second chapter content... ${'content '.repeat(100)}

PART 2

CHAPTER 1

Second part, first chapter content... ${'content '.repeat(100)}

*** END OF THE PROJECT GUTENBERG EBOOK WAR AND PEACE ***
`;

    const chapters = parseGutenbergChapters(multiPartBook);
    const ch1List = chapters.filter((c) => c.title === 'CHAPTER 1');
    expect(ch1List.length).toBe(2);
    expect(ch1List[0].content).toContain('First part, first chapter');
    expect(ch1List[1].content).toContain('Second part, first chapter');
  });
});


