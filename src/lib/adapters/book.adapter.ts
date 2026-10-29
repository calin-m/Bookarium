import type { GutendexBook, Author, Book } from '@/types/book.types';
import { formatAuthorName } from '@/lib/utils';
import { cleanBookTitle } from '@/lib/book-metadata';
import { parseLifespansFromName } from '@/lib/copyright-engine';

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
      : typeof (input as GutendexBook).download_count === 'number'
      ? (input as GutendexBook).download_count
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
 * Converts a canonical Book or raw GutendexBook into a standard GutendexBook entity,
 * preserving author lifespans (`authorDetails` or parsed date strings) and format URLs.
 */
export function toGutendexBook(input: Book | GutendexBook): GutendexBook {
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
      ...(input.coverUrl ? { 'image/jpeg': input.coverUrl } : {}),
      'application/epub+zip': input.epubUrl || `https://www.gutenberg.org/ebooks/${id}.epub3.images`,
      'text/html': input.htmlUrl || `https://www.gutenberg.org/ebooks/${id}.html.images`,
      'text/plain; charset=utf-8': input.txtUrl || `https://www.gutenberg.org/ebooks/${id}.txt.utf-8`,
      'application/x-mobipocket-ebook': `https://www.gutenberg.org/ebooks/${id}.kindle.images`,
    },
    download_count: Number.isFinite(input.downloadCount) ? input.downloadCount : 0,
  };
}

export interface CloudBookRow {
  book_id: number;
  book_title: string;
  book_authors: (string | Author)[] | null;
  cover_url: string | null;
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
 * Reconstructs a full GutendexBook from a cloud database row (bookshelf_items or user_favorites).
 * Preserves author lifespans and applies fallback regex extraction from author strings.
 */
export function toGutendexBookFromCloudRow(item: CloudBookRow): GutendexBook {
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

  return {
    id: item.book_id,
    title: item.book_title,
    authors,
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
 * Transforms a GutendexBook entity into a normalized Supabase insert payload,
 * preserving author lifespans in JSON/string representations.
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
  const formattedAuthors: string[] = (book.authors || []).map(formatAuthorWithLifespan);

  const base: CloudFavoriteInsertPayload = {
    user_id: userId,
    book_id: book.id,
    book_title: book.title,
    book_authors: formattedAuthors,
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

