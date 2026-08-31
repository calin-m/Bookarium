/**
 * Featured Classic Books Fixtures for Bookarium
 * Centralized metadata for Hero spotlights and featured book cards.
 */

export interface FeaturedHeroBook {
  id: number;
  volumeNumber: string;
  title: string;
  author: string;
  year: string;
  quoteExcerpt: string;
  license: string;
  primarySubject: string;
}

export const FEATURED_HERO_BOOKS: FeaturedHeroBook[] = [
  {
    id: 1342,
    volumeNumber: 'Vol. 1342',
    title: 'Pride and Prejudice',
    author: 'Jane Austen',
    year: '1813',
    quoteExcerpt:
      'It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.',
    license: 'CC0 / Public Domain',
    primarySubject: 'Classic Romance & Social Satire',
  },
  {
    id: 84,
    volumeNumber: 'Vol. 84',
    title: 'Frankenstein',
    author: 'Mary Wollstonecraft Shelley',
    year: '1818',
    quoteExcerpt:
      'Beware; for I am fearless, and therefore powerful.',
    license: 'CC0 / Public Domain',
    primarySubject: 'Gothic Science Fiction & Horror',
  },
  {
    id: 2701,
    volumeNumber: 'Vol. 2701',
    title: 'Moby Dick',
    author: 'Herman Melville',
    year: '1851',
    quoteExcerpt:
      'Call me Ishmael. Some years ago—never mind how long precisely—having little or no money in my purse...',
    license: 'CC0 / Public Domain',
    primarySubject: 'Maritime Epic & Adventure',
  },
  {
    id: 64317,
    volumeNumber: 'Vol. 64317',
    title: 'The Great Gatsby',
    author: 'F. Scott Fitzgerald',
    year: '1925',
    quoteExcerpt:
      'So we beat on, boats against the current, borne back ceaselessly into the past.',
    license: 'CC0 / Public Domain',
    primarySubject: 'Jazz Age & American Tragedy',
  },
  {
    id: 11,
    volumeNumber: 'Vol. 11',
    title: "Alice's Adventures in Wonderland",
    author: 'Lewis Carroll',
    year: '1865',
    quoteExcerpt:
      '“Curiouser and curiouser!” cried Alice (she was so much surprised, that for the moment she quite forgot how to speak good English).',
    license: 'CC0 / Public Domain',
    primarySubject: 'Literary Nonsense & Fantasy',
  },
  {
    id: 174,
    volumeNumber: 'Vol. 174',
    title: 'The Picture of Dorian Gray',
    author: 'Oscar Wilde',
    year: '1890',
    quoteExcerpt:
      'The only way to get rid of a temptation is to yield to it. Resist it, and your soul grows sick with longing.',
    license: 'CC0 / Public Domain',
    primarySubject: 'Philosophical & Aesthetic Fiction',
  },
  {
    id: 1661,
    volumeNumber: 'Vol. 1661',
    title: 'The Adventures of Sherlock Holmes',
    author: 'Arthur Conan Doyle',
    year: '1892',
    quoteExcerpt:
      'It is a capital mistake to theorize before one has data. Insensibly one begins to twist facts to suit theories.',
    license: 'CC0 / Public Domain',
    primarySubject: 'Detective Fiction & Mystery',
  },
  {
    id: 345,
    volumeNumber: 'Vol. 345',
    title: 'Dracula',
    author: 'Bram Stoker',
    year: '1897',
    quoteExcerpt:
      'Listen to them, the children of the night. What music they make!',
    license: 'CC0 / Public Domain',
    primarySubject: 'Gothic Horror & Vampire Fiction',
  },
  {
    id: 98,
    volumeNumber: 'Vol. 98',
    title: 'A Tale of Two Cities',
    author: 'Charles Dickens',
    year: '1859',
    quoteExcerpt:
      'It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness...',
    license: 'CC0 / Public Domain',
    primarySubject: 'Historical Fiction & Revolution',
  },
  {
    id: 35,
    volumeNumber: 'Vol. 35',
    title: 'The Time Machine',
    author: 'H. G. Wells',
    year: '1895',
    quoteExcerpt:
      'Nature never appeals to intelligence until habit and instinct are useless. There is no intelligence where there is no need of change.',
    license: 'CC0 / Public Domain',
    primarySubject: 'Time Travel & Science Fiction',
  },
];

export const FEATURED_HERO_BOOK: FeaturedHeroBook = FEATURED_HERO_BOOKS[0];

