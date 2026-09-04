/**
 * Canonical Domain Types for Project Gutenberg & Gutendex Entities
 */

export interface Author {
  name: string;
  birth_year: number | null;
  death_year: number | null;
}

export interface GutendexBook {
  id: number;
  title: string;
  authors: Author[];
  translators: Author[];
  subjects: string[];
  bookshelves: string[];
  languages: string[];
  copyright: boolean | null;
  media_type: string;
  formats: Record<string, string>;
  download_count: number;
}

export interface GutendexResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: GutendexBook[];
  source?: 'upstream' | 'cache';
  latencyMs?: number;
}

export type ReadingStatus = 'want_to_read' | 'currently_reading' | 'finished';

export interface BookCuration {
  bookId: number;
  rating: number | null;
  readingStatus: ReadingStatus | null;
  ratedAt?: string;
  statusUpdatedAt?: string;
}

/**
 * Provider-agnostic Canonical Domain Entity for a Book
 */
export interface Book {
  id: number;
  title: string;
  authors: string[];
  subjects: string[];
  languages: string[];
  coverUrl: string | null;
  epubUrl: string | null;
  htmlUrl: string | null;
  txtUrl: string | null;
  downloadCount: number;
}

export type LedgerFilter = 'all' | 'in_progress' | 'completed' | 'on_hold';
export type LedgerItemStatus = 'in_progress' | 'completed' | 'on_hold';

/**
 * Reading coordinate representation for an active volume in the reading ledger
 */
export interface ActiveReadingVolume {
  book: Book;
  progressPercent: number;
  lastReadAt: string;
  chapterIndex: number;
  chapterPage: number;
  globalPage: number;
  status: LedgerItemStatus;
  bookmarksCount: number;
  lastPassageSnippet?: string;
}

