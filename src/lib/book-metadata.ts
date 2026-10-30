import type { GutendexBook, GutendexResponse, Book, Author } from '@/types/book.types';
import { FEATURED_HERO_BOOKS } from '@/config/featured-books';
import { formatAuthorNames, formatPrimarySubject } from '@/lib/utils';
import { parseLifespansFromName } from '@/lib/copyright-engine';

export interface ResolvedBookIdentity {
  id: number;
  title: string;
  author: string;
  displayAuthor: string;
  primarySubject: string;
  languages: string[];
  isPublicDomain: boolean;
  authors: Author[];
  translators: Author[];
}

export interface ResolveBookMetadataParams {
  id: number;
  currentBook?: GutendexBook | Book | null;
  booksData?: GutendexResponse | null;
  extractedMeta?: { title?: string; author?: string; language?: string } | null;
}

/**
 * Strips raw Project Gutenberg preamble prefixes from title strings, e.g.:
 * "The Project Gutenberg eBook of Frankenstein; Or, The Modern Prometheus" -> "Frankenstein; Or, The Modern Prometheus"
 * "The Project Gutenberg EBook of ..." -> "..."
 * "Project Gutenberg's ..." -> "..."
 */
export function cleanBookTitle(title?: string | null): string {
  if (!title || typeof title !== 'string') return '';
  let clean = title.replace(/\s+/g, ' ').trim();
  clean = clean.replace(/^the project gutenberg (?:ebook|e-book|edition)\s+(?:of\s+)?/i, '');
  clean = clean.replace(/^project gutenberg(?:'s)?\s+(?:ebook|e-book|edition)?\s*(?:of\s+)?/i, '');
  clean = clean.replace(/^the gutenberg (?:ebook|e-book|edition)\s+(?:of\s+)?/i, '');
  return clean.trim() || title.trim();
}

/**
 * Validates whether an author string is a non-empty, authentic author name
 * rather than a generic fallback placeholder.
 */
export function isPlaceholderAuthor(author?: string | null): boolean {
  if (!author || typeof author !== 'string') return true;
  const trimmed = author.trim().toLowerCase();
  return (
    trimmed === '' ||
    trimmed === 'unknown' ||
    trimmed === 'unknown author' ||
    trimmed === 'anonymous' ||
    trimmed === 'classic masterwork' ||
    trimmed === 'public domain classic' ||
    trimmed === 'the author' ||
    trimmed === 'project gutenberg' ||
    trimmed === 'various' ||
    trimmed === 'various authors'
  );
}

/**
 * Validates whether a title string is a non-empty, authentic literary title
 * rather than a generic fallback placeholder.
 */
export function isPlaceholderTitle(title?: string | null): boolean {
  if (!title || typeof title !== 'string') return true;
  const trimmed = title.trim().toLowerCase();
  return (
    trimmed === '' ||
    trimmed === 'unknown volume' ||
    trimmed === 'public domain classic' ||
    /^gutenberg volume #\d+$/.test(trimmed) ||
    trimmed === 'the project gutenberg ebook' ||
    trimmed === 'the project gutenberg e-book' ||
    trimmed === 'project gutenberg ebook'
  );
}

/**
 * Validates whether an author list contains at least one non-placeholder author name.
 */
export function hasAuthenticAuthors(
  authors?: Array<Author | string | { name?: string | null } | null | undefined> | null
): boolean {
  if (!Array.isArray(authors) || authors.length === 0) return false;
  return authors.some((a) => {
    const name = typeof a === 'string' ? a : a?.name;
    return Boolean(name && !isPlaceholderAuthor(name));
  });
}

/**
 * Validates whether an author list contains at least one author with known birth or death years
 * (either via numeric `birth_year`/`death_year` fields or lifespans embedded in the author name string).
 */
export function hasAuthorLifespans(
  authors?: Array<
    | Author
    | string
    | { name?: string | null; birth_year?: number | null; death_year?: number | null }
    | null
    | undefined
  > | null
): boolean {
  if (!Array.isArray(authors) || authors.length === 0) return false;
  return authors.some((a) => {
    if (!a) return false;
    if (typeof a === 'string') {
      const parsed = parseLifespansFromName(a);
      return parsed.birthYear != null || parsed.deathYear != null;
    }
    if (a.birth_year != null || a.death_year != null) return true;
    if (a.name) {
      const parsed = parseLifespansFromName(a.name);
      return parsed.birthYear != null || parsed.deathYear != null;
    }
    return false;
  });
}

/**
 * Converts a curated `FeaturedHeroBook` fixture (or partial hero metadata) into a canonical `GutendexBook` payload.
 */
export function featuredHeroToGutendexBook(
  hero: {
    id: number;
    title: string;
    author?: string;
    authorBirthYear?: number | null;
    authorDeathYear?: number | null;
    primarySubject?: string;
  },
  options?: {
    formats?: Record<string, string>;
    downloadCount?: number;
  }
): GutendexBook {
  return {
    id: hero.id,
    title: hero.title,
    authors: [
      {
        name: hero.author || 'Classic Masterwork',
        birth_year: hero.authorBirthYear ?? null,
        death_year: hero.authorDeathYear ?? null,
      },
    ],
    translators: [],
    subjects: [hero.primarySubject || 'Classic Literature'],
    bookshelves: [],
    languages: ['en'],
    copyright: false,
    media_type: 'Text',
    formats: options?.formats ?? {
      'image/jpeg': `https://www.gutenberg.org/cache/epub/${hero.id}/pg${hero.id}.cover.medium.jpg`,
    },
    download_count: options?.downloadCount ?? 0,
  };
}

/**
 * Canonical domain resolver: Determines the optimal title, author, subjects, and language
 * for a book across all available tiers (Client Store, Static Fixtures, API Results, and Gutenberg Raw Headers).
 */
export function resolveBookMetadata({
  id,
  currentBook,
  booksData,
  extractedMeta,
}: ResolveBookMetadataParams): ResolvedBookIdentity {
  const numericId = typeof id === 'number' ? id : parseInt(String(id), 10) || 0;

  // Tier 1: Static Preloaded Fixture (0ms instant match for curated classics)
  const featuredFixture = numericId > 0
    ? FEATURED_HERO_BOOKS.find((fb) => fb.id === numericId)
    : undefined;

  // Tier 2: Zustand Client Store (If currently selected book matches requested ID)
  const storeBook = currentBook?.id === numericId ? currentBook : undefined;

  // Tier 3: REST API Query Results
  const apiBook = booksData?.results?.find((b: GutendexBook) => b.id === numericId);

  // Author Resolution Priority: Store -> Fixture -> API -> Raw Text Header
  const rawStoreAuthor = storeBook?.authors ? formatAuthorNames(storeBook.authors) : '';
  const rawFixtureAuthor = featuredFixture ? formatAuthorNames(featuredFixture.author) : '';
  const rawApiAuthor = apiBook?.authors ? formatAuthorNames(apiBook.authors) : '';
  let rawExtractedAuthor = extractedMeta?.author ? formatAuthorNames(extractedMeta.author) : '';
  if (rawExtractedAuthor) {
    rawExtractedAuthor = rawExtractedAuthor.replace(/^by\s+/i, '').trim();
  }

  const resolvedAuthor =
    (!isPlaceholderAuthor(rawStoreAuthor) ? rawStoreAuthor : '') ||
    (!isPlaceholderAuthor(rawFixtureAuthor) ? rawFixtureAuthor : '') ||
    (!isPlaceholderAuthor(rawApiAuthor) ? rawApiAuthor : '') ||
    (!isPlaceholderAuthor(rawExtractedAuthor) ? rawExtractedAuthor : '') ||
    rawFixtureAuthor ||
    '';

  // Title Resolution Priority: Store -> Fixture -> API -> Raw Text Header -> Fallback
  const rawStoreTitle = cleanBookTitle(storeBook?.title);
  const rawFixtureTitle = cleanBookTitle(featuredFixture?.title);
  const rawApiTitle = cleanBookTitle(apiBook?.title);
  const rawExtractedTitle = cleanBookTitle(extractedMeta?.title);

  const candidateTitle =
    (!isPlaceholderTitle(rawStoreTitle) ? rawStoreTitle : '') ||
    (!isPlaceholderTitle(rawFixtureTitle) ? rawFixtureTitle : '') ||
    (!isPlaceholderTitle(rawApiTitle) ? rawApiTitle : '') ||
    (!isPlaceholderTitle(rawExtractedTitle) ? rawExtractedTitle : '') ||
    rawFixtureTitle ||
    rawStoreTitle ||
    rawApiTitle ||
    rawExtractedTitle ||
    (numericId > 0 ? `Gutenberg Volume #${numericId}` : 'Public Domain Classic');

  const resolvedTitle = cleanBookTitle(candidateTitle);

  // Primary Subject
  const primarySubject =
    (storeBook?.subjects && formatPrimarySubject(storeBook.subjects)) ||
    featuredFixture?.primarySubject ||
    (apiBook?.subjects && formatPrimarySubject(apiBook.subjects)) ||
    'Classic Literature';

  // Languages Resolution Priority: Store (matching ID) -> API Result -> Raw Header Extraction -> Fallback ['en']
  const resolvedLanguages =
    (storeBook?.languages && storeBook.languages.length > 0 ? storeBook.languages : undefined) ||
    (apiBook?.languages && apiBook.languages.length > 0 ? apiBook.languages : undefined) ||
    (extractedMeta?.language ? [extractedMeta.language] : undefined) ||
    ['en'];

  // Structured Authors & Translators Resolution Priority
  let resolvedAuthors: Author[] = [];
  let resolvedTranslators: Author[] = [];

  const toAuthorWithParsedLifespans = (a: string | Author): Author => {
    if (typeof a === 'string') {
      const parsed = parseLifespansFromName(a);
      return {
        name: a,
        birth_year: parsed.birthYear,
        death_year: parsed.deathYear,
      };
    }
    if (a.birth_year == null && a.death_year == null && a.name) {
      const parsed = parseLifespansFromName(a.name);
      return {
        ...a,
        birth_year: parsed.birthYear,
        death_year: parsed.deathYear,
      };
    }
    return a;
  };

  const storeAuthorDetails =
    storeBook && 'authorDetails' in storeBook && Array.isArray(storeBook.authorDetails) && storeBook.authorDetails.length > 0
      ? storeBook.authorDetails.map(toAuthorWithParsedLifespans)
      : undefined;

  const storeNormalizedAuthors =
    storeAuthorDetails ||
    (storeBook?.authors && storeBook.authors.length > 0
      ? storeBook.authors.map(toAuthorWithParsedLifespans)
      : undefined);

  // Tier A: If apiBook has authors with lifespans (or no fixture/store has lifespans)
  if (
    apiBook?.authors &&
    apiBook.authors.length > 0 &&
    (apiBook.authors.some((a) => a.birth_year != null || a.death_year != null) ||
      (!storeNormalizedAuthors?.some((a) => a.birth_year != null || a.death_year != null) && !featuredFixture))
  ) {
    resolvedAuthors = apiBook.authors.map(toAuthorWithParsedLifespans);
    resolvedTranslators = apiBook.translators || [];
  }
  // Tier B: If storeBook (via authorDetails or authors) has lifespans
  else if (
    storeNormalizedAuthors &&
    storeNormalizedAuthors.length > 0 &&
    storeNormalizedAuthors.some((a) => a.birth_year != null || a.death_year != null)
  ) {
    resolvedAuthors = storeNormalizedAuthors;
    resolvedTranslators = (storeBook as GutendexBook)?.translators || [];
  }
  // Tier C: Curated static fixture (with authorBirthYear / authorDeathYear)
  else if (featuredFixture) {
    resolvedAuthors = [
      {
        name: featuredFixture.author,
        birth_year: featuredFixture.authorBirthYear ?? null,
        death_year: featuredFixture.authorDeathYear ?? null,
      },
    ];
    resolvedTranslators = [];
  }
  // Tier D: Fallback to storeBook if present
  else if (storeNormalizedAuthors && storeNormalizedAuthors.length > 0) {
    resolvedAuthors = storeNormalizedAuthors;
    resolvedTranslators = (storeBook as GutendexBook)?.translators || [];
  }
  // Tier E: Plain resolvedAuthor string
  else if (resolvedAuthor) {
    resolvedAuthors = [toAuthorWithParsedLifespans(resolvedAuthor)];
    resolvedTranslators = [];
  }

  return {
    id: numericId,
    title: resolvedTitle,
    author: resolvedAuthor,
    displayAuthor: resolvedAuthor || 'Public Domain Classic',
    primarySubject,
    languages: resolvedLanguages,
    isPublicDomain: true,
    authors: resolvedAuthors,
    translators: resolvedTranslators,
  };
}
