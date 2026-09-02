import type { GutendexBook, GutendexResponse } from '@/types/book.types';
import { FEATURED_HERO_BOOKS } from '@/config/featured-books';
import { formatAuthorNames, formatPrimarySubject } from '@/lib/utils';

export interface ResolvedBookIdentity {
  id: number;
  title: string;
  author: string;
  displayAuthor: string;
  primarySubject: string;
  languages: string[];
  isPublicDomain: boolean;
}

export interface ResolveBookMetadataParams {
  id: number;
  currentBook?: GutendexBook | null;
  booksData?: GutendexResponse | null;
  extractedMeta?: { title?: string; author?: string; language?: string } | null;
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
    trimmed === 'anonymous' ||
    trimmed === 'classic masterwork' ||
    trimmed === 'public domain classic' ||
    trimmed === 'the author'
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
    /^gutenberg volume #\d+$/.test(trimmed)
  );
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
  const rawExtractedAuthor = extractedMeta?.author ? formatAuthorNames(extractedMeta.author) : '';

  const resolvedAuthor =
    (!isPlaceholderAuthor(rawStoreAuthor) ? rawStoreAuthor : '') ||
    (!isPlaceholderAuthor(rawFixtureAuthor) ? rawFixtureAuthor : '') ||
    (!isPlaceholderAuthor(rawApiAuthor) ? rawApiAuthor : '') ||
    (!isPlaceholderAuthor(rawExtractedAuthor) ? rawExtractedAuthor : '') ||
    rawFixtureAuthor ||
    '';

  // Title Resolution Priority: Store -> Fixture -> API -> Raw Text Header -> Fallback
  const rawStoreTitle = storeBook?.title?.replace(/\s+/g, ' ').trim() || '';
  const rawFixtureTitle = featuredFixture?.title?.replace(/\s+/g, ' ').trim() || '';
  const rawApiTitle = apiBook?.title?.replace(/\s+/g, ' ').trim() || '';
  const rawExtractedTitle = extractedMeta?.title?.replace(/\s+/g, ' ').trim() || '';

  const resolvedTitle =
    (!isPlaceholderTitle(rawStoreTitle) ? rawStoreTitle : '') ||
    (!isPlaceholderTitle(rawFixtureTitle) ? rawFixtureTitle : '') ||
    (!isPlaceholderTitle(rawApiTitle) ? rawApiTitle : '') ||
    (!isPlaceholderTitle(rawExtractedTitle) ? rawExtractedTitle : '') ||
    rawFixtureTitle ||
    rawStoreTitle ||
    rawApiTitle ||
    rawExtractedTitle ||
    (numericId > 0 ? `Gutenberg Volume #${numericId}` : 'Public Domain Classic');

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

  return {
    id: numericId,
    title: resolvedTitle,
    author: resolvedAuthor,
    displayAuthor: resolvedAuthor || 'Public Domain Classic',
    primarySubject,
    languages: resolvedLanguages,
    isPublicDomain: true,
  };
}
