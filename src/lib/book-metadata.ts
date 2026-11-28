/**
 * @module
 * @scope Canonical bibliographic identity normalization, placeholder guard predicates (`isPlaceholderAuthor`,
 *        `isPlaceholderTitle`), canonical SERP title/excerpt formatters (`formatReaderDocumentTitle`,
 *        `truncateTextAtWordBoundary`, `resolveBookOpeningSnippet`), and multi-source book metadata resolution utilities.
 * @invariant Identify generic fallback strings (`"Anonymous"`, `"Unknown Author"`, `"Classic Masterwork"`, `"Volume #N"`, `"Gutenberg Volume #N"`) consistently so storage, sync, and ledger layers never overwrite authentic author metadata or titles with placeholders.
 * @invariant Resolve authentic title/author identity in priority order `FEATURED_HERO_BOOKS` / `currentBook` -> `booksData` -> `localBook` -> `extractedMeta` while cleaning raw Project Gutenberg title preambles (`cleanBookTitle`).
 * @rationale Consistent placeholder detection across Reader, Bookshelf, Cloud Sync, and IndexedDB is foundational to preventing both metadata loss and false non-US `HTTP 451` copyright blocks.
 * @adr ADR-016, ADR-070, ADR-074
 */

import type { CatalogBook, CatalogResponse, Book, Author } from '@/types/book.types';
import { FEATURED_HERO_BOOKS } from '@/config/featured-books';
import { SITE_CONFIG } from '@/config/site-config';
import { buildR2CoverUrl, formatAuthorNames, formatPrimarySubject } from '@/lib/utils';
import { parseLifespansFromName } from '@/lib/copyright-engine';

export interface ResolvedBookIdentity {
  id: number;
  title: string;
  author: string;
  displayAuthor: string;
  primarySubject: string;
  subjects: string[];
  bookshelves: string[];
  languages: string[];
  isPublicDomain: boolean;
  authors: Author[];
  translators: Author[];
}

export interface ResolveBookMetadataParams {
  id: number;
  currentBook?: CatalogBook | Book | null;
  booksData?: CatalogResponse | null;
  localBook?: CatalogBook | Book | null;
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
    /^(?:gutenberg\s+)?volume #\d+$/.test(trimmed) ||
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
 * Converts a curated `FeaturedHeroBook` fixture (or partial hero metadata) into a canonical `CatalogBook` payload.
 */
export function featuredHeroToCatalogBook(
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
): CatalogBook {
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
    formats:
      options?.formats ??
      (buildR2CoverUrl(hero.id) ? { 'image/jpeg': buildR2CoverUrl(hero.id)! } : {}),
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
  localBook,
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
  const apiBook = booksData?.results?.find((b: CatalogBook) => b.id === numericId);

  // Tier 4: Local Collection / Offline Record Fallback (matched ID)
  const matchedLocalBook = localBook?.id === numericId ? localBook : undefined;

  // Author Resolution Priority: Store -> Fixture -> API -> Local Collection -> Raw Text Header
  const rawStoreAuthor = storeBook?.authors ? formatAuthorNames(storeBook.authors) : '';
  const rawFixtureAuthor = featuredFixture ? formatAuthorNames(featuredFixture.author) : '';
  const rawApiAuthor = apiBook?.authors ? formatAuthorNames(apiBook.authors) : '';
  const rawLocalAuthor = matchedLocalBook?.authors ? formatAuthorNames(matchedLocalBook.authors) : '';
  let rawExtractedAuthor = extractedMeta?.author ? formatAuthorNames(extractedMeta.author) : '';
  if (rawExtractedAuthor) {
    rawExtractedAuthor = rawExtractedAuthor.replace(/^by\s+/i, '').trim();
  }

  const resolvedAuthor =
    (!isPlaceholderAuthor(rawStoreAuthor) ? rawStoreAuthor : '') ||
    (!isPlaceholderAuthor(rawFixtureAuthor) ? rawFixtureAuthor : '') ||
    (!isPlaceholderAuthor(rawApiAuthor) ? rawApiAuthor : '') ||
    (!isPlaceholderAuthor(rawLocalAuthor) ? rawLocalAuthor : '') ||
    (!isPlaceholderAuthor(rawExtractedAuthor) ? rawExtractedAuthor : '') ||
    rawFixtureAuthor ||
    '';

  // Title Resolution Priority: Store -> Fixture -> API -> Local Collection -> Raw Text Header -> Fallback
  const rawStoreTitle = cleanBookTitle(storeBook?.title);
  const rawFixtureTitle = cleanBookTitle(featuredFixture?.title);
  const rawApiTitle = cleanBookTitle(apiBook?.title);
  const rawLocalTitle = cleanBookTitle(matchedLocalBook?.title);
  const rawExtractedTitle = cleanBookTitle(extractedMeta?.title);

  const candidateTitle =
    (!isPlaceholderTitle(rawStoreTitle) ? rawStoreTitle : '') ||
    (!isPlaceholderTitle(rawFixtureTitle) ? rawFixtureTitle : '') ||
    (!isPlaceholderTitle(rawApiTitle) ? rawApiTitle : '') ||
    (!isPlaceholderTitle(rawLocalTitle) ? rawLocalTitle : '') ||
    (!isPlaceholderTitle(rawExtractedTitle) ? rawExtractedTitle : '') ||
    rawFixtureTitle ||
    rawStoreTitle ||
    rawApiTitle ||
    rawLocalTitle ||
    rawExtractedTitle ||
    (numericId > 0 ? `Gutenberg Volume #${numericId}` : 'Public Domain Classic');

  const resolvedTitle = cleanBookTitle(candidateTitle);

  const filterNonEmptyStrings = (values?: unknown): string[] =>
    Array.isArray(values)
      ? values.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
      : [];

  // Primary Subject, Subjects & Curated Bookshelves
  const storeSubjects = filterNonEmptyStrings(storeBook?.subjects);
  const apiSubjects = filterNonEmptyStrings(apiBook?.subjects);
  const localSubjects = filterNonEmptyStrings(matchedLocalBook?.subjects);
  const resolvedSubjects =
    storeSubjects.length > 0
      ? storeSubjects
      : apiSubjects.length > 0
      ? apiSubjects
      : localSubjects.length > 0
      ? localSubjects
      : featuredFixture?.primarySubject
      ? [featuredFixture.primarySubject]
      : [];

  const storeBookshelves =
    storeBook && 'bookshelves' in storeBook ? filterNonEmptyStrings(storeBook.bookshelves) : [];
  const apiBookshelves = filterNonEmptyStrings(apiBook?.bookshelves);
  const localBookshelves =
    matchedLocalBook && 'bookshelves' in matchedLocalBook
      ? filterNonEmptyStrings(matchedLocalBook.bookshelves)
      : [];
  const resolvedBookshelves =
    storeBookshelves.length > 0
      ? storeBookshelves
      : apiBookshelves.length > 0
      ? apiBookshelves
      : localBookshelves;

  const primarySubject =
    (storeSubjects.length > 0 && formatPrimarySubject(storeSubjects)) ||
    featuredFixture?.primarySubject ||
    (apiSubjects.length > 0 && formatPrimarySubject(apiSubjects)) ||
    (localSubjects.length > 0 && formatPrimarySubject(localSubjects)) ||
    'Classic Literature';

  // Languages Resolution Priority: Store (matching ID) -> API Result -> Local Collection -> Raw Header Extraction -> Fallback ['en']
  const resolvedLanguages =
    (storeBook?.languages && storeBook.languages.length > 0 ? storeBook.languages : undefined) ||
    (apiBook?.languages && apiBook.languages.length > 0 ? apiBook.languages : undefined) ||
    (matchedLocalBook?.languages && matchedLocalBook.languages.length > 0
      ? matchedLocalBook.languages
      : undefined) ||
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

  const extractNormalizedBookAuthors = (book?: CatalogBook | Book | null): Author[] | undefined => {
    if (!book) return undefined;
    if ('authorDetails' in book && Array.isArray(book.authorDetails) && book.authorDetails.length > 0) {
      return book.authorDetails.map(toAuthorWithParsedLifespans);
    }
    if (book.authors && book.authors.length > 0) {
      return book.authors.map(toAuthorWithParsedLifespans);
    }
    return undefined;
  };

  const storeNormalizedAuthors = extractNormalizedBookAuthors(storeBook);
  const localNormalizedAuthors = extractNormalizedBookAuthors(matchedLocalBook);

  // Tier A: If apiBook has authors with lifespans (or no fixture/store/local has lifespans)
  if (
    apiBook?.authors &&
    apiBook.authors.length > 0 &&
    (apiBook.authors.some((a) => a.birth_year != null || a.death_year != null) ||
      (!storeNormalizedAuthors?.some((a) => a.birth_year != null || a.death_year != null) &&
        !localNormalizedAuthors?.some((a) => a.birth_year != null || a.death_year != null) &&
        !featuredFixture))
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
    resolvedTranslators = (storeBook as CatalogBook)?.translators || [];
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
  // Tier D: Local shelf / offline book with contributor lifespans
  else if (
    localNormalizedAuthors &&
    localNormalizedAuthors.length > 0 &&
    localNormalizedAuthors.some((a) => a.birth_year != null || a.death_year != null)
  ) {
    resolvedAuthors = localNormalizedAuthors;
    resolvedTranslators = (matchedLocalBook as CatalogBook)?.translators || [];
  }
  // Tier E: Fallback to storeBook or localBook if present
  else if (storeNormalizedAuthors && storeNormalizedAuthors.length > 0) {
    resolvedAuthors = storeNormalizedAuthors;
    resolvedTranslators = (storeBook as CatalogBook)?.translators || [];
  } else if (localNormalizedAuthors && localNormalizedAuthors.length > 0) {
    resolvedAuthors = localNormalizedAuthors;
    resolvedTranslators = (matchedLocalBook as CatalogBook)?.translators || [];
  }
  // Tier F: Plain resolvedAuthor string
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
    subjects: resolvedSubjects,
    bookshelves: resolvedBookshelves,
    languages: resolvedLanguages,
    isPublicDomain: true,
    authors: resolvedAuthors,
    translators: resolvedTranslators,
  };
}

/**
 * Formats keyword-first SEO document titles consistently across SSR metadata and client navigation.
 */
export function formatReaderDocumentTitle(
  title: string,
  displayAuthor?: string | null,
  siteName: string = SITE_CONFIG.NAME
): string {
  const cleanTitle = (title || '').trim() || 'Public Domain Classic';
  const cleanAuthor =
    displayAuthor && !isPlaceholderAuthor(displayAuthor) ? displayAuthor.trim() : '';
  return cleanAuthor
    ? `${cleanTitle} by ${cleanAuthor} — Read Free | ${siteName}`
    : `${cleanTitle} — Read Free | ${siteName}`;
}

/**
 * Truncates prose cleanly at word boundaries without leaving trailing punctuation before ellipsis.
 */
export function truncateTextAtWordBoundary(rawText: string, maxLength: number): string {
  const collapsed = rawText.replace(/\s+/g, ' ').trim();
  if (!collapsed || collapsed.length <= maxLength) return collapsed;
  const sliced = collapsed.slice(0, Math.max(1, maxLength - 1));
  const lastSpace = sliced.lastIndexOf(' ');
  const cutoff = lastSpace > Math.floor(maxLength * 0.45) ? sliced.slice(0, lastSpace) : sliced;
  return `${cutoff.replace(/[,;:\s]+$/, '')}…`;
}

/**
 * Resolves the highest-priority literary hook across Supabase quote records and curated hero fixtures.
 */
export function resolveBookOpeningSnippet(bookId: number, bookData?: CatalogBook | null): string {
  const firstDbQuote = bookData?.quotes?.[0];
  const dbSnippet = firstDbQuote?.openingLine?.trim() || firstDbQuote?.quoteExcerpt?.trim();
  if (dbSnippet) return dbSnippet;
  const featuredFixture = FEATURED_HERO_BOOKS.find((b) => b.id === bookId);
  return featuredFixture?.openingLine || featuredFixture?.quoteExcerpt || '';
}
