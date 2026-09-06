import type { GutendexBook, Author, Book } from '@/types/book.types';
import { formatAuthorName } from '@/lib/utils';
import { cleanBookTitle } from '@/lib/book-metadata';

/**
 * Normalizes Gutenberg author name formatting ("Austen, Jane" -> "Jane Austen")
 * Delegates to canonical formatAuthorName from lib/utils for DRY architecture.
 */
export function normalizeAuthorName(rawName: string): string {
  return formatAuthorName(rawName);
}

/**
 * Extracts first available URL matching any of the preferred MIME types from a format dictionary.
 */
export function extractFormatUrl(
  formats: Record<string, string> | undefined | null,
  preferredMimes: string[]
): string | null {
  if (!formats || typeof formats !== 'object') return null;

  for (const mime of preferredMimes) {
    // Exact match first
    if (formats[mime]) return formats[mime];

    // Prefix/partial match (e.g. text/plain; charset=utf-8 matching text/plain)
    const matchedKey = Object.keys(formats).find(
      (key) => key.toLowerCase().startsWith(mime.toLowerCase()) || key.toLowerCase().includes(mime.toLowerCase())
    );
    if (matchedKey && formats[matchedKey]) {
      return formats[matchedKey];
    }
  }

  return null;
}

/**
 * Type guard checking if an entity is already a canonical domain Book
 */
export function isCanonicalBook(entity: unknown): entity is Book {
  if (!entity || typeof entity !== 'object') return false;
  const candidate = entity as Record<string, unknown>;
  return (
    typeof candidate.id === 'number' &&
    typeof candidate.title === 'string' &&
    Array.isArray(candidate.authors) &&
    (candidate.authors.length === 0 || typeof candidate.authors[0] === 'string') &&
    'coverUrl' in candidate &&
    'epubUrl' in candidate &&
    'htmlUrl' in candidate &&
    'txtUrl' in candidate &&
    typeof candidate.downloadCount === 'number'
  );
}

/**
 * Transforms an upstream GutendexBook or partial representation into a canonical Book domain entity.
 * Guaranteed idempotent: passing an already-canonical Book returns an identical canonical Book.
 */
export function toCanonicalBook(
  input: GutendexBook | Book | Partial<GutendexBook & Book> | null | undefined
): Book {
  if (!input) {
    return {
      id: 0,
      title: 'Unknown Title',
      authors: ['Anonymous'],
      subjects: [],
      languages: [],
      coverUrl: null,
      epubUrl: null,
      htmlUrl: null,
      txtUrl: null,
      downloadCount: 0,
    };
  }

  // Idempotent fast-path
  if (isCanonicalBook(input)) {
    return { ...input };
  }

  // Extract author list
  let authors: string[] = [];
  if (Array.isArray(input.authors)) {
    authors = input.authors.map((author: string | Author) => {
      if (typeof author === 'string') return normalizeAuthorName(author);
      if (author && typeof author === 'object' && 'name' in author) {
        return normalizeAuthorName(author.name);
      }
      return 'Anonymous';
    });
  }
  if (authors.length === 0) {
    authors = ['Anonymous'];
  }

  const formats = 'formats' in input && input.formats ? input.formats : undefined;

  const coverUrl =
    ('coverUrl' in input && typeof input.coverUrl === 'string' ? input.coverUrl : null) ||
    extractFormatUrl(formats, ['image/jpeg', 'image/png', 'image/webp']);

  const epubUrl =
    ('epubUrl' in input && typeof input.epubUrl === 'string' ? input.epubUrl : null) ||
    extractFormatUrl(formats, ['application/epub+zip']);

  const htmlUrl =
    ('htmlUrl' in input && typeof input.htmlUrl === 'string' ? input.htmlUrl : null) ||
    extractFormatUrl(formats, ['text/html; charset=utf-8', 'text/html']);

  const txtUrl =
    ('txtUrl' in input && typeof input.txtUrl === 'string' ? input.txtUrl : null) ||
    extractFormatUrl(formats, ['text/plain; charset=utf-8', 'text/plain; charset=us-ascii', 'text/plain']);

  const downloadCount =
    typeof (input as { downloadCount?: number }).downloadCount === 'number'
      ? (input as { downloadCount: number }).downloadCount
      : typeof (input as GutendexBook).download_count === 'number'
      ? (input as GutendexBook).download_count
      : 0;

  return {
    id: input.id ?? 0,
    title: cleanBookTitle(input.title) || 'Untitled',
    authors,
    subjects: Array.isArray(input.subjects) ? [...input.subjects] : [],
    languages: Array.isArray(input.languages) ? [...input.languages] : [],
    coverUrl,
    epubUrl,
    htmlUrl,
    txtUrl,
    downloadCount,
  };
}

export interface CloudBookRow {
  book_id: number;
  book_title: string;
  book_authors: string[] | null;
  cover_url: string | null;
}

/**
 * Reconstructs a full GutendexBook from a cloud database row (bookshelf_items or user_favorites).
 * Encapsulates Gutenberg format URL synthesis and author normalization in a single canonical place.
 */
export function toGutendexBookFromCloudRow(item: CloudBookRow): GutendexBook {
  return {
    id: item.book_id,
    title: item.book_title,
    authors: (item.book_authors || []).map((name: string) => ({ name, birth_year: null, death_year: null })),
    translators: [],
    subjects: [],
    bookshelves: [],
    languages: ['en'],
    copyright: false,
    media_type: 'Text',
    formats: {
      ...(item.cover_url ? { 'image/jpeg': item.cover_url } : {}),
      'application/epub+zip': `https://www.gutenberg.org/ebooks/${item.book_id}.epub3.images`,
      'text/html': `https://www.gutenberg.org/ebooks/${item.book_id}.html.images`,
      'text/plain; charset=utf-8': `https://www.gutenberg.org/ebooks/${item.book_id}.txt.utf-8`,
      'application/x-mobipocket-ebook': `https://www.gutenberg.org/ebooks/${item.book_id}.kindle.images`,
    },
    download_count: 1000,
  };
}

export interface CloudFavoriteInsertPayload {
  user_id: string;
  book_id: number;
  book_title: string;
  book_authors: string[];
  cover_url: string | null;
}

export interface CloudBookshelfItemInsertPayload extends CloudFavoriteInsertPayload {
  bookshelf_id: string;
}

export type CloudBookInsertPayload = CloudFavoriteInsertPayload | CloudBookshelfItemInsertPayload;

/**
 * Transforms a GutendexBook entity into a normalized Supabase insert payload.
 */
export function toCloudBookInsert(
  book: GutendexBook,
  userId: string,
  bookshelfId: string
): CloudBookshelfItemInsertPayload;
export function toCloudBookInsert(
  book: GutendexBook,
  userId: string
): CloudFavoriteInsertPayload;
export function toCloudBookInsert(
  book: GutendexBook,
  userId: string,
  bookshelfId?: string
): CloudFavoriteInsertPayload | CloudBookshelfItemInsertPayload {
  const base: CloudFavoriteInsertPayload = {
    user_id: userId,
    book_id: book.id,
    book_title: book.title,
    book_authors: book.authors?.map((a) => a.name) || [],
    cover_url: book.formats?.['image/jpeg'] || null,
  };
  if (bookshelfId) {
    return {
      ...base,
      bookshelf_id: bookshelfId,
    };
  }
  return base;
}

