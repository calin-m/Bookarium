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

export const FEATURED_HERO_BOOK: FeaturedHeroBook = {
  id: 1342,
  volumeNumber: 'Vol. 1342',
  title: 'Pride and Prejudice',
  author: 'Jane Austen',
  year: '1813',
  quoteExcerpt:
    'It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.',
  license: 'CC0 / Public Domain',
  primarySubject: 'Classic Romance & Social Satire',
};

