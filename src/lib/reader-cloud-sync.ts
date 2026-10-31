import type { GutendexBook, Book, Author } from '@/types/book.types';
import { parseLifespansFromName } from '@/lib/copyright-engine';
import { hasAuthorLifespans } from '@/lib/book-metadata';

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

export function hasEmbeddedLifespans(authors?: string[]): boolean {
  return hasAuthorLifespans(authors);
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
} {
  const remoteAuthors = row.book_authors as string[] | null | undefined;
  const shouldKeepLocalAuthors =
    !hasEmbeddedLifespans(remoteAuthors ?? undefined) &&
    hasEmbeddedLifespans(localPos?.bookAuthors);
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
    bookTitle: (row.book_title as string | null) || localPos?.bookTitle,
    bookAuthors:
      (shouldKeepLocalAuthors ? localPos?.bookAuthors : remoteAuthors) ||
      localPos?.bookAuthors,
    coverUrl: (row.cover_url as string | null) || localPos?.coverUrl,
  };
  const progress = Math.min(
    Math.max(Math.round(Number(row.progress_percent)), 0),
    100
  );
  return { position, progress, shouldKeepLocalAuthors };
}

export function extractVerifiedAuthors(
  book: GutendexBook | Book | null | undefined,
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

