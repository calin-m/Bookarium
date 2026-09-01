import { describe, it, expect } from 'vitest';
import {
  normalizeSearchText,
  extractSearchTokens,
  matchesSmartSearch,
  getBookSearchHaystack,
  filterBooksSmart,
} from './smart-search';
import type { GutendexBook } from '@/mocks/handlers';

const mockBooks: GutendexBook[] = [
  {
    id: 1342,
    title: 'Pride and Prejudice',
    authors: [{ name: 'Austen, Jane', birth_year: 1775, death_year: 1817 }],
    translators: [],
    subjects: ['Courtship -- Fiction', 'England -- Fiction', 'Sisters -- Fiction'],
    bookshelves: ['Best Books Ever', 'Harvard Classics'],
    languages: ['en'],
    copyright: false,
    media_type: 'Text',
    formats: {},
    download_count: 50000,
  },
  {
    id: 84,
    title: 'Frankenstein; Or, The Modern Prometheus',
    authors: [{ name: 'Shelley, Mary Wollstonecraft', birth_year: 1797, death_year: 1851 }],
    translators: [],
    subjects: ['Monsters -- Fiction', 'Science fiction', 'Horror tales'],
    bookshelves: ['Gothic Fiction', 'Precursors of Science Fiction'],
    languages: ['en'],
    copyright: false,
    media_type: 'Text',
    formats: {},
    download_count: 45000,
  },
  {
    id: 2000,
    title: 'Don Quijote de la Mancha',
    authors: [{ name: 'Cervantes Saavedra, Miguel de', birth_year: 1547, death_year: 1616 }],
    translators: [],
    subjects: ['Knights and knighthood -- Spain -- Fiction'],
    bookshelves: ['Classics in Spanish'],
    languages: ['es'],
    copyright: false,
    media_type: 'Text',
    formats: {},
    download_count: 30000,
  },
  {
    id: 2701,
    title: 'Moby Dick; Or, The Whale',
    authors: [{ name: 'Melville, Herman', birth_year: 1819, death_year: 1891 }],
    translators: [],
    subjects: ['Whaling -- Fiction', 'Sea stories', 'Adventure stories'],
    bookshelves: ['Best Books Ever'],
    languages: ['en'],
    copyright: false,
    media_type: 'Text',
    formats: {},
    download_count: 60000,
  },
];

describe('normalizeSearchText', () => {
  it('should return empty string for null, undefined, or empty inputs', () => {
    expect(normalizeSearchText('')).toBe('');
    expect(normalizeSearchText(null)).toBe('');
    expect(normalizeSearchText(undefined)).toBe('');
  });

  it('should lowercase text', () => {
    expect(normalizeSearchText('HERMAN MELVILLE')).toBe('herman melville');
  });

  it('should strip diacritics and accents', () => {
    expect(normalizeSearchText('Don Quijóte de la Mancha')).toBe('don quijote de la mancha');
    expect(normalizeSearchText('Crème Brûlée & Café')).toBe('creme brulee cafe');
  });

  it('should replace punctuation with single spaces and trim', () => {
    expect(normalizeSearchText('Pride & Prejudice; Or, A Novel')).toBe('pride prejudice or a novel');
  });
});

describe('extractSearchTokens', () => {
  it('should return empty array for empty queries', () => {
    expect(extractSearchTokens('')).toEqual([]);
    expect(extractSearchTokens('   ')).toEqual([]);
    expect(extractSearchTokens(null)).toEqual([]);
  });

  it('should split multi-word query into normalized tokens', () => {
    expect(extractSearchTokens('Pride  Austen')).toEqual(['pride', 'austen']);
    expect(extractSearchTokens('Mary   Shelley;  Frankenstein!')).toEqual([
      'mary',
      'shelley',
      'frankenstein',
    ]);
  });
});

describe('matchesSmartSearch', () => {
  const item = {
    title: 'The Adventures of Sherlock Holmes',
    author: 'Arthur Conan Doyle',
    genre: 'Detective Fiction',
  };
  const getHaystack = (i: typeof item) => `${i.title} ${i.author} ${i.genre}`;

  it('should return true for empty or whitespace query', () => {
    expect(matchesSmartSearch(item, '', getHaystack)).toBe(true);
    expect(matchesSmartSearch(item, '   ', getHaystack)).toBe(true);
  });

  it('should match single exact and partial words', () => {
    expect(matchesSmartSearch(item, 'sherlock', getHaystack)).toBe(true);
    expect(matchesSmartSearch(item, 'doyle', getHaystack)).toBe(true);
    expect(matchesSmartSearch(item, 'detect', getHaystack)).toBe(true);
  });

  it('should match multi-word query in natural order', () => {
    expect(matchesSmartSearch(item, 'sherlock holmes', getHaystack)).toBe(true);
    expect(matchesSmartSearch(item, 'arthur conan doyle', getHaystack)).toBe(true);
  });

  it('should match multi-word query in REVERSE / arbitrary word order', () => {
    expect(matchesSmartSearch(item, 'holmes sherlock', getHaystack)).toBe(true);
    expect(matchesSmartSearch(item, 'doyle sherlock arthur', getHaystack)).toBe(true);
    expect(matchesSmartSearch(item, 'detective arthur adventures', getHaystack)).toBe(true);
  });

  it('should return false if any token is missing from haystack', () => {
    expect(matchesSmartSearch(item, 'sherlock poirot', getHaystack)).toBe(false);
    expect(matchesSmartSearch(item, 'doyle agatha', getHaystack)).toBe(false);
  });
});

describe('filterBooksSmart', () => {
  it('should return all books when query is empty or blank', () => {
    expect(filterBooksSmart(mockBooks, '')).toHaveLength(4);
    expect(filterBooksSmart(mockBooks, '   ')).toHaveLength(4);
  });

  it('should filter by title', () => {
    const result = filterBooksSmart(mockBooks, 'Frankenstein');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(84);
  });

  it('should filter by author name', () => {
    const result = filterBooksSmart(mockBooks, 'Jane Austen');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1342);
  });

  it('should filter with title + author in mixed / arbitrary word order', () => {
    const resultForward = filterBooksSmart(mockBooks, 'austen pride');
    const resultReverse = filterBooksSmart(mockBooks, 'pride austen');
    expect(resultForward).toHaveLength(1);
    expect(resultReverse).toHaveLength(1);
    expect(resultForward[0].id).toBe(1342);
    expect(resultReverse[0].id).toBe(1342);
  });

  it('should filter by subject / genre', () => {
    const result = filterBooksSmart(mockBooks, 'Whaling');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2701);
  });

  it('should filter by bookshelf tag', () => {
    const result = filterBooksSmart(mockBooks, 'Harvard Classics');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1342);
  });

  it('should filter with diacritics / accent variations', () => {
    const resultAccented = filterBooksSmart(mockBooks, 'Quijóte');
    const resultUnaccented = filterBooksSmart(mockBooks, 'Quijote');
    expect(resultAccented).toHaveLength(1);
    expect(resultUnaccented).toHaveLength(1);
    expect(resultAccented[0].id).toBe(2000);
    expect(resultUnaccented[0].id).toBe(2000);
  });

  it('should return empty array when query does not match any volume', () => {
    const result = filterBooksSmart(mockBooks, 'NonExistentBookXYZ');
    expect(result).toHaveLength(0);
  });
});

describe('getBookSearchHaystack', () => {
  it('should concatenate title, authors, subjects, bookshelves, and languages into searchable string', () => {
    const haystack = getBookSearchHaystack(mockBooks[0]);
    expect(haystack).toContain('Pride and Prejudice');
    expect(haystack).toContain('Austen, Jane');
    expect(haystack).toContain('Courtship -- Fiction');
    expect(haystack).toContain('Harvard Classics');
    expect(haystack).toContain('en');
  });
});

