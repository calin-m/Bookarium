/**
 * @module src/lib/reader-cloud-sync
 * @scope Serialization, fractional row-bookmark decoding, synthetic Page-1 ghost detection, position metadata extraction, and lifespan-preserving reconciliation for `public.reading_progress`.
 * @invariant Encode row bookmark offsets fractionally on `scroll_offset` (`page + row / 1000`) alongside reflow-anchored `bookmark_text`, and identify empty Page-1 rows cleanly via `isGhostReadingPosition` / `isGhostCloudRow`.
 * @invariant Reject placeholder titles/authors (`hasAuthenticPositionTitle`, `hasAuthenticPositionAuthors`), preserve local titles/authors when remote `public.reading_progress` rows lack them (`shouldHealRemoteMetadata`), and keep embedded contributor lifespans (`hasEmbeddedLifespans`) during cloud merges (`extractVerifiedAuthors`).
 * @rationale Shared row encoding, zero-cycle metadata extraction, and ghost classification keep `public.reading_progress` titles/authors intact across direct navigation, offline reads, and multi-device syncs without `HTTP 451` lifespan regressions.
 * @adr ADR-014, ADR-068, ADR-070, ADR-080
 */

import type { CatalogBook, Book, Author } from '@/types/book.types';
import { parseLifespansFromName } from '@/lib/copyright-engine';
import {
  cleanBookTitle,
  hasAuthorLifespans,
  isPlaceholderAuthor,
  isPlaceholderTitle,
} from '@/lib/book-metadata';
import { formatAuthorWithLifespan } from '@/lib/adapters/book.adapter';
import { resolveBookCoverUrl } from '@/lib/utils';

export type ReaderTheme = 'light' | 'dark' | 'sepia';
export type ReaderFontFamily = 'serif' | 'sans' | 'mono';

export interface BookReadingPosition {
  chapterIndex: number;
  chapterPage: number;
  globalPage: number;
  bookmarkRow?: number;
  bookmarkText?: string;
  lastReadAt: string;
  bookTitle?: string;
  bookAuthors?: string[];
  coverUrl?: string | null;
}

export interface BookPositionMetadata {
  bookTitle?: string;
  bookAuthors?: string[];
  coverUrl?: string | null;
}

export function hasEmbeddedLifespans(authors?: string[]): boolean {
  return hasAuthorLifespans(authors);
}

export function hasAuthenticPositionTitle(title?: string | null): boolean {
  return Boolean(title && !isPlaceholderTitle(cleanBookTitle(title)));
}

export function hasAuthenticPositionAuthors(authors?: string[] | null): boolean {
  return Boolean(
    Array.isArray(authors) && authors.length > 0 && !authors.every(isPlaceholderAuthor)
  );
}

export function extractBookPositionMetadata(
  bookId: number,
  book:
    | (Pick<CatalogBook | Book, 'id' | 'title' | 'authors'> & {
        authorDetails?: Author[];
        formats?: Record<string, string>;
        coverUrl?: string | null;
      })
    | null
    | undefined
): BookPositionMetadata {
  if (!book || bookId <= 0) return {};

  const cleanedTitle = cleanBookTitle(book.title);
  const resolvedTitle = hasAuthenticPositionTitle(cleanedTitle) ? cleanedTitle : undefined;
  const rawAuthorSources: (string | Author)[] =
    'authorDetails' in book && Array.isArray(book.authorDetails) && book.authorDetails.length > 0
      ? book.authorDetails
      : book.authors || [];
  const resolvedAuthors = rawAuthorSources
    .map((author) => formatAuthorWithLifespan(author))
    .filter((name) => Boolean(name && !isPlaceholderAuthor(name)));
  const rawCover =
    ('formats' in book && book.formats?.['image/jpeg']) ||
    ('coverUrl' in book ? book.coverUrl : null) ||
    null;
  const resolvedCover = resolveBookCoverUrl(bookId, rawCover);

  return {
    ...(resolvedTitle ? { bookTitle: resolvedTitle } : {}),
    ...(resolvedAuthors.length > 0 ? { bookAuthors: resolvedAuthors } : {}),
    ...(resolvedCover ? { coverUrl: resolvedCover } : {}),
  };
}

export function isGhostReadingPosition(
  pos: BookReadingPosition,
  progress: number
): boolean {
  return (
    progress === 0 &&
    pos.chapterIndex === 0 &&
    pos.chapterPage <= 1 &&
    pos.globalPage <= 1 &&
    (pos.bookmarkRow ?? 0) <= 0 &&
    !pos.bookmarkText
  );
}

export function isGhostCloudRow(row: Record<string, unknown>): boolean {
  return (
    Number(row.progress_percent) === 0 &&
    Number(row.current_chapter_index) === 0 &&
    Number(row.scroll_offset) <= 1 &&
    !row.bookmark_text
  );
}

export function decodeRemoteReadingPosition(
  row: Record<string, unknown>,
  localPos?: BookReadingPosition
): {
  position: BookReadingPosition;
  progress: number;
  shouldKeepLocalAuthors: boolean;
  shouldHealRemoteMetadata: boolean;
} {
  const remoteTitle = typeof row.book_title === 'string' ? row.book_title : null;
  const hasExplicitRemoteAuthorArray = Array.isArray(row.book_authors);
  const remoteAuthors = hasExplicitRemoteAuthorArray
    ? (row.book_authors as string[])
    : null;
  const hasRemoteTitle = hasAuthenticPositionTitle(remoteTitle);
  const hasLocalTitle = hasAuthenticPositionTitle(localPos?.bookTitle);
  const hasRemoteAuthors = hasAuthenticPositionAuthors(remoteAuthors);
  const hasLocalAuthors = hasAuthenticPositionAuthors(localPos?.bookAuthors);
  const shouldKeepLocalAuthors =
    !hasEmbeddedLifespans(remoteAuthors ?? undefined) &&
    hasEmbeddedLifespans(localPos?.bookAuthors);
  const shouldHealMissingAuthors = !hasRemoteAuthors && hasLocalAuthors;
  const shouldHealRemoteMetadata = Boolean(
    shouldKeepLocalAuthors ||
      ((row.book_title == null || !hasRemoteTitle) && hasLocalTitle) ||
      (hasExplicitRemoteAuthorArray && shouldHealMissingAuthors)
  );
  const rawOffset = Math.max(1, Number(row.scroll_offset));
  const decodedPage = Math.max(1, Math.floor(rawOffset));
  const decodedRow = Math.round((rawOffset - decodedPage) * 1000);
  const remoteBookmarkText =
    typeof row.bookmark_text === 'string' && row.bookmark_text.trim().length > 0
      ? row.bookmark_text.trim()
      : undefined;
  const fallbackBookmarkText =
    !remoteBookmarkText &&
    decodedRow > 0 &&
    localPos?.chapterIndex === Number(row.current_chapter_index) &&
    localPos?.chapterPage === decodedPage &&
    localPos?.bookmarkRow === decodedRow
      ? localPos?.bookmarkText
      : undefined;
  const resolvedBookmarkText =
    decodedRow > 0 || remoteBookmarkText
      ? remoteBookmarkText || fallbackBookmarkText
      : undefined;
  const position: BookReadingPosition = {
    chapterIndex: Number(row.current_chapter_index),
    chapterPage: decodedPage,
    globalPage: decodedPage,
    ...(decodedRow > 0 ? { bookmarkRow: decodedRow } : {}),
    ...(resolvedBookmarkText ? { bookmarkText: resolvedBookmarkText } : {}),
    lastReadAt: String(row.last_read_at),
    bookTitle:
      (hasRemoteTitle ? remoteTitle! : undefined) ||
      localPos?.bookTitle ||
      remoteTitle ||
      undefined,
    bookAuthors:
      (shouldKeepLocalAuthors || shouldHealMissingAuthors
        ? localPos?.bookAuthors
        : remoteAuthors) || localPos?.bookAuthors,
    coverUrl: resolveBookCoverUrl(
      Number(row.book_id),
      (row.cover_url as string | null) || localPos?.coverUrl
    ),
  };
  const progress = Math.min(
    Math.max(Math.round(Number(row.progress_percent)), 0),
    100
  );
  return {
    position,
    progress,
    shouldKeepLocalAuthors,
    shouldHealRemoteMetadata,
  };
}

export function extractVerifiedAuthors(
  book: CatalogBook | Book | null | undefined,
  pos?: BookReadingPosition
): Author[] | undefined {
  if (book) {
    if ('authorDetails' in book && Array.isArray(book.authorDetails)) {
      const withDates = book.authorDetails.filter(
        (a) => a.birth_year != null || a.death_year != null
      );
      if (withDates.length > 0) return book.authorDetails;
    }
    if (Array.isArray(book.authors) && book.authors.length > 0) {
      const parsedAuthors: Author[] = [];
      let hasDates = false;
      for (const a of book.authors) {
        if (typeof a === 'string') {
          const parsed = parseLifespansFromName(a);
          if (parsed.birthYear != null || parsed.deathYear != null) {
            hasDates = true;
          }
          parsedAuthors.push({
            name: a,
            birth_year: parsed.birthYear,
            death_year: parsed.deathYear,
          });
        } else if (a && typeof a === 'object' && 'name' in a) {
          const parsed =
            a.birth_year == null && a.death_year == null && a.name
              ? parseLifespansFromName(a.name)
              : {
                  birthYear: a.birth_year ?? null,
                  deathYear: a.death_year ?? null,
                };
          if (parsed.birthYear != null || parsed.deathYear != null) {
            hasDates = true;
          }
          parsedAuthors.push({
            ...a,
            birth_year: parsed.birthYear,
            death_year: parsed.deathYear,
          });
        }
      }
      if (hasDates) return parsedAuthors;
    }
  }
  if (pos?.bookAuthors && hasEmbeddedLifespans(pos.bookAuthors)) {
    return pos.bookAuthors.map((raw) => {
      const parsed = parseLifespansFromName(raw);
      return {
        name: raw,
        birth_year: parsed.birthYear,
        death_year: parsed.deathYear,
      };
    });
  }
  return undefined;
}

