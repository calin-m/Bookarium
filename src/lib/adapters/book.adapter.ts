/**
 * @module src/lib/adapters/book.adapter
 * @scope Pure bidirectional DTO adapters (`toCanonicalBook`, `toCatalogBook`, `toCatalogBookFromCloudRow`, `toCloudBookInsert`, `sanitizeCatalogBookCover`, `normalizeCloudCoverUrl`) reconciling catalog DTOs, lean relational rows, and domain `Book` entities.
 * @invariant Strip derivable R2 proxy paths, Gutenberg mirror URLs (`GUTENBERG_COVER_HOSTS`), and transient `blob:`/`data:` URIs inside `normalizeCloudCoverUrl`, rewrite legacy mirror covers to same-origin R2 defaults via `sanitizeCatalogBookCover` and `resolveBookCoverUrl`, preserve `authorDetails` lifespans idempotently, and emit metadata-free `(user_id, book_id[, bookshelf_id])` inserts via `toCloudBookInsert`.
 * @rationale Keeping cloud rows normalized to IDs while deriving uniform R2 covers and preserving verified author lifespans in memory prevents metadata bloat and external Gutenberg hotlinking across local and cloud collections.
 * @adr ADR-070, ADR-071, ADR-084, ADR-087
 */

import type { CatalogBook, Author, Book } from '@/types/book.types';
import { API_ENDPOINTS } from '@/config/api-endpoints';
import {
  formatAuthorName,
  GUTENBERG_COVER_HOSTS,
  buildR2BookFormats,
  buildR2CoverUrl,
  resolveBookCoverUrl,
} from '@/lib/utils';
import { cleanBookTitle } from '@/lib/book-metadata';
import { parseLifespansFromName } from '@/lib/copyright-engine';

export { GUTENBERG_COVER_HOSTS };

/**
 * Strips derivable Project Gutenberg cover URLs, same-origin R2 cover proxy paths, and transient
 * client `blob:` / `data:` URIs down to `null` before cloud persistence while keeping custom URLs intact.
 */
export function normalizeCloudCoverUrl(url?: string | null): string | null {
  const trimmed = (url || '').trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();
  if (lower.startsWith('blob:') || lower.startsWith('data:')) {
    return null;
  }

  if (
    trimmed === API_ENDPOINTS.INTERNAL_API_CONTENT ||
    trimmed.startsWith(`${API_ENDPOINTS.INTERNAL_API_CONTENT}?`) ||
    trimmed.startsWith(`${API_ENDPOINTS.INTERNAL_API_CONTENT}/`)
  ) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    const isHttp = parsed.protocol === 'https:' || parsed.protocol === 'http:';
    if (
      isHttp &&
      (GUTENBERG_COVER_HOSTS.has(parsed.hostname.toLowerCase()) ||
        parsed.pathname === API_ENDPOINTS.INTERNAL_API_CONTENT)
    ) {
      return null;
    }
  } catch {
    // Relative non-proxy custom URLs are preserved cleanly
  }

  return trimmed;
}

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
 * Transforms a raw CatalogBook or partial representation into a canonical Book domain entity.
 * Guaranteed idempotent: passing an already-canonical Book returns an identical canonical Book.
 */
export function toCanonicalBook(
  input: CatalogBook | Book | Partial<CatalogBook & Book> | null | undefined
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

  // Idempotent fast-path (enriches authorDetails if embedded lifespans exist in string authors or unparsed authorDetails)
  if (isCanonicalBook(input)) {
    const hasVerifiedDetails = input.authorDetails?.some(
      (a) => a.birth_year != null || a.death_year != null
    );
    if (!hasVerifiedDetails) {
      const parsedDetails: Author[] = [];
      const normalizedAuthors = input.authors.map((raw) => {
        const parsed = parseLifespansFromName(raw);
        if (parsed.birthYear != null || parsed.deathYear != null) {
          parsedDetails.push({
            name: raw,
            birth_year: parsed.birthYear,
            death_year: parsed.deathYear,
          });
        }
        return normalizeAuthorName(raw);
      });
      if (parsedDetails.length === 0 && input.authorDetails?.length) {
        for (const detail of input.authorDetails) {
          const parsed = parseLifespansFromName(detail.name);
          if (parsed.birthYear != null || parsed.deathYear != null) {
            parsedDetails.push({
              ...detail,
              birth_year: parsed.birthYear,
              death_year: parsed.deathYear,
            });
          }
        }
      }
      if (parsedDetails.length > 0) {
        return {
          ...input,
          authors: normalizedAuthors,
          authorDetails: parsedDetails,
        };
      }
    }
    return { ...input };
  }

  // Extract author list and detailed lifespans
  let authors: string[] = [];
  const authorDetails: Author[] = [];
  if (Array.isArray(input.authors)) {
    authors = input.authors.map((author: string | Author) => {
      if (typeof author === 'string') {
        const parsed = parseLifespansFromName(author);
        if (parsed.birthYear != null || parsed.deathYear != null) {
          authorDetails.push({
            name: author,
            birth_year: parsed.birthYear,
            death_year: parsed.deathYear,
          });
        }
        return normalizeAuthorName(author);
      }
      if (author && typeof author === 'object' && 'name' in author) {
        const parsed =
          author.birth_year == null && author.death_year == null && author.name
            ? parseLifespansFromName(author.name)
            : { birthYear: author.birth_year ?? null, deathYear: author.death_year ?? null };
        authorDetails.push({
          ...author,
          name: author.name,
          birth_year: parsed.birthYear,
          death_year: parsed.deathYear,
        });
        return normalizeAuthorName(author.name);
      }
      return 'Anonymous';
    });
  }
  if (authors.length === 0) {
    authors = ['Anonymous'];
  }
  if ('authorDetails' in input && Array.isArray(input.authorDetails)) {
    for (const detail of input.authorDetails) {
      if (!authorDetails.some((existing) => existing.name === detail.name && (existing.birth_year != null || existing.death_year != null))) {
        authorDetails.push(detail);
      }
    }
  }

  const rawTranslators = 'translators' in input && Array.isArray(input.translators) ? input.translators : [];
  const rawCopyright = 'copyright' in input ? input.copyright : undefined;

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
      : typeof (input as CatalogBook).download_count === 'number'
      ? (input as CatalogBook).download_count
      : 0;

  return {
    id: input.id ?? 0,
    title: cleanBookTitle(input.title) || 'Untitled',
    authors,
    ...(authorDetails.length > 0 ? { authorDetails } : {}),
    ...(rawTranslators.length > 0 ? { translators: rawTranslators } : {}),
    ...(rawCopyright !== undefined ? { copyright: rawCopyright } : {}),
    subjects: Array.isArray(input.subjects) ? [...input.subjects] : [],
    languages: Array.isArray(input.languages) ? [...input.languages] : [],
    coverUrl,
    epubUrl,
    htmlUrl,
    txtUrl,
    downloadCount,
  };
}

/**
 * Converts a canonical Book or raw CatalogBook into a standard CatalogBook entity,
 * preserving author lifespans (`authorDetails` or parsed date strings) and format URLs.
 */
export function toCatalogBook(input: Book | CatalogBook): CatalogBook {
  if (!isCanonicalBook(input)) {
    return input;
  }

  let authors: Author[] = [];
  if (Array.isArray(input.authorDetails) && input.authorDetails.length > 0) {
    authors = input.authorDetails.map((detail) => {
      const parsed =
        detail.birth_year == null && detail.death_year == null && detail.name
          ? parseLifespansFromName(detail.name)
          : { birthYear: detail.birth_year ?? null, deathYear: detail.death_year ?? null };
      return {
        ...detail,
        name: detail.name,
        birth_year: parsed.birthYear,
        death_year: parsed.deathYear,
      };
    });
  } else if (Array.isArray(input.authors) && input.authors.length > 0) {
    authors = input.authors.map((name) => {
      const parsed = parseLifespansFromName(name);
      return {
        name,
        birth_year: parsed.birthYear,
        death_year: parsed.deathYear,
      };
    });
  }

  const id = input.id;
  const resolvedCover = resolveBookCoverUrl(id, input.coverUrl);
  return {
    id,
    title: input.title,
    authors,
    translators: Array.isArray(input.translators) ? [...input.translators] : [],
    subjects: Array.isArray(input.subjects) ? [...input.subjects] : [],
    bookshelves: [],
    languages: Array.isArray(input.languages) && input.languages.length > 0 ? [...input.languages] : ['en'],
    copyright: input.copyright ?? false,
    media_type: 'Text',
    formats: {
      ...buildR2BookFormats(id),
      ...(resolvedCover ? { 'image/jpeg': resolvedCover } : {}),
      ...(input.epubUrl ? { 'application/epub+zip': input.epubUrl } : {}),
      ...(input.htmlUrl ? { 'text/html': input.htmlUrl } : {}),
      ...(input.txtUrl ? { 'text/plain; charset=utf-8': input.txtUrl } : {}),
    },
    download_count: Number.isFinite(input.downloadCount) ? input.downloadCount : 0,
  };
}

export interface CloudBookRow {
  book_id: number;
  book_title?: string | null;
  book_authors?: (string | Author)[] | null;
  cover_url?: string | null;
}

/**
 * Formats an Author object or string into a lifespan-preserving string representation
 * (e.g. "Austen, Jane, 1775-1817", "Author, d. 1920", "Author, b. 1850").
 */
export function formatAuthorWithLifespan(author: string | Author): string {
  if (typeof author === 'string') return author;
  if (author && typeof author === 'object') {
    const hasDates = author.birth_year != null || author.death_year != null;
    if (hasDates) {
      const parsed = parseLifespansFromName(author.name);
      if (parsed.deathYear == null && parsed.birthYear == null) {
        if (author.birth_year != null && author.death_year != null) {
          return `${author.name}, ${author.birth_year}-${author.death_year}`;
        }
        if (author.death_year != null) {
          return `${author.name}, d. ${author.death_year}`;
        }
        if (author.birth_year != null) {
          return `${author.name}, b. ${author.birth_year}`;
        }
      }
    }
    return author.name;
  }
  return 'Anonymous';
}

/**
 * Reconstructs a full CatalogBook from a cloud database row (bookshelf_items or user_favorites).
 * Preserves author lifespans and applies fallback regex extraction from author strings.
 */
export function toCatalogBookFromCloudRow(item: CloudBookRow): CatalogBook {
  const authors: Author[] = [];

  if (Array.isArray(item.book_authors)) {
    for (const authorItem of item.book_authors) {
      if (authorItem && typeof authorItem === 'object' && 'name' in authorItem) {
        const a = authorItem as Author;
        const parsed = (a.birth_year == null && a.death_year == null && a.name)
          ? parseLifespansFromName(a.name)
          : { birthYear: a.birth_year ?? null, deathYear: a.death_year ?? null };
        authors.push({
          name: a.name,
          birth_year: parsed.birthYear,
          death_year: parsed.deathYear,
        });
      } else if (typeof authorItem === 'string') {
        const parsed = parseLifespansFromName(authorItem);
        authors.push({
          name: authorItem,
          birth_year: parsed.birthYear,
          death_year: parsed.deathYear,
        });
      }
    }
  }

  const r2CoverUrl = buildR2CoverUrl(item.book_id);
  const resolvedCover = resolveBookCoverUrl(item.book_id, item.cover_url);
  const r2Formats = buildR2BookFormats(item.book_id);

  return {
    id: item.book_id,
    title: item.book_title?.trim() || `Volume #${item.book_id}`,
    authors,
    translators: [],
    subjects: [],
    bookshelves: [],
    languages: ['en'],
    copyright: false,
    media_type: 'Text',
    formats: {
      ...r2Formats,
      ...(resolvedCover ? { 'image/jpeg': resolvedCover } : r2CoverUrl ? { 'image/jpeg': r2CoverUrl } : {}),
    },
    download_count: 1000,
  };
}

/**
 * Normalizes a persisted `CatalogBook` cover format (`formats['image/jpeg']`) from Project Gutenberg
 * mirror hosts to same-origin R2 (`/api/books/content?id=<id>&type=cover`), returning the same
 * object reference when no rewrite is needed.
 */
export function sanitizeCatalogBookCover(book: CatalogBook): CatalogBook {
  if (!book || typeof book.id !== 'number') return book;
  const existingFormats = book.formats && typeof book.formats === 'object' ? book.formats : undefined;
  const rawCover = existingFormats?.['image/jpeg'];
  if (!rawCover) {
    return book;
  }
  const normalizedCover = resolveBookCoverUrl(book.id, rawCover);
  if (!normalizedCover || normalizedCover === rawCover) {
    return book;
  }
  return {
    ...book,
    formats: {
      ...existingFormats,
      'image/jpeg': normalizedCover,
    },
  };
}

export interface CloudFavoriteInsertPayload {
  user_id: string;
  book_id: number;
}

export interface CloudBookshelfItemInsertPayload extends CloudFavoriteInsertPayload {
  bookshelf_id: string;
}

export type CloudBookInsertPayload = CloudFavoriteInsertPayload | CloudBookshelfItemInsertPayload;

/**
 * Transforms a CatalogBook entity into a lean normalized Supabase relational insert payload
 * (`public.books` serves as the single source of truth for bibliographic metadata).
 */
export function toCloudBookInsert(
  book: CatalogBook,
  userId: string,
  bookshelfId: string
): CloudBookshelfItemInsertPayload;
export function toCloudBookInsert(
  book: CatalogBook,
  userId: string
): CloudFavoriteInsertPayload;
export function toCloudBookInsert(
  book: CatalogBook,
  userId: string,
  bookshelfId?: string
): CloudFavoriteInsertPayload | CloudBookshelfItemInsertPayload {
  const base: CloudFavoriteInsertPayload = {
    user_id: userId,
    book_id: book.id,
  };
  if (bookshelfId) {
    return {
      ...base,
      bookshelf_id: bookshelfId,
    };
  }
  return base;
}

