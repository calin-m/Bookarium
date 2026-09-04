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

