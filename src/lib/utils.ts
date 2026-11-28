/**
 * @module src/lib/utils
 * @scope Core presentation, R2 asset URL derivation, protocol sanitization, author/LCSH normalization, and Tailwind class-merge utilities.
 * @invariant Map missing and legacy Project Gutenberg cover hosts (`GUTENBERG_COVER_HOSTS`) to same-origin R2 endpoints (`buildR2CoverUrl`, `buildR2TextUrl`, `buildR2BookFormats`, `resolveBookCoverUrl`) for positive integer book IDs, preserve caller `blob:` / `data:` URIs when permitted, and fall back safely to R2 defaults inside `extractBookFormats`.
 * @invariant Enforce strict protocol allowlisting inside `sanitizeBookFormatUrl` (permitting only `https:`, optional `blob:`, and same-origin `API_ENDPOINTS.INTERNAL_API_CONTENT` when `allowInternalContentPath` is set) while rejecting `javascript:`, `data:`, `vbscript:`, `//`, and unencrypted `http:` URLs; preserve lineage suffixes cleanly in `formatAuthorName`.
 * @rationale Eliminating runtime Gutenberg cover URLs at the normalization boundary prevents browser mirror hotlinking and mixed-content/XSS URI injection across cards, shelves, bookmarks, and reader adapters.
 * @adr ADR-070, ADR-080, ADR-084, ADR-087
 */

import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';
import { API_ENDPOINTS } from '@/config/api-endpoints';

/**
 * Known Project Gutenberg & official mirror hostnames whose cover artwork is always served
 * deterministically from private Cloudflare R2 via `/api/books/content?id=<bookId>&type=cover`.
 */
export const GUTENBERG_COVER_HOSTS: ReadonlySet<string> = new Set([
  'www.gutenberg.org',
  'gutenberg.org',
  'aleph.gutenberg.org',
  'gutenberg.pglaf.org',
  'gutenberg.readingroo.ms',
]);

/**
 * Builds the canonical same-origin R2 cover proxy URL for a positive integer volume ID.
 */
export function buildR2CoverUrl(bookId?: number | null): string | null {
  if (typeof bookId !== 'number' || !Number.isInteger(bookId) || bookId <= 0) {
    return null;
  }
  return `${API_ENDPOINTS.INTERNAL_API_CONTENT}?id=${Math.trunc(bookId)}&type=cover`;
}

/**
 * Builds the canonical same-origin R2 plain-text proxy URL for a positive integer volume ID.
 */
export function buildR2TextUrl(bookId?: number | null): string | null {
  if (typeof bookId !== 'number' || !Number.isInteger(bookId) || bookId <= 0) {
    return null;
  }
  return `${API_ENDPOINTS.INTERNAL_API_CONTENT}?id=${Math.trunc(bookId)}`;
}

/**
 * Synthesizes uniform R2-backed format URLs (`text/plain; charset=utf-8` & `image/jpeg`)
 * deterministically from `bookId` without storing duplicate format maps in PostgreSQL.
 */
export function buildR2BookFormats(bookId?: number | null): Record<string, string> {
  const textUrl = buildR2TextUrl(bookId);
  const coverUrl = buildR2CoverUrl(bookId);
  return {
    ...(textUrl ? { 'text/plain; charset=utf-8': textUrl } : {}),
    ...(coverUrl ? { 'image/jpeg': coverUrl } : {}),
  };
}

/**
 * Canonical client/server cover URL resolver eliminating Project Gutenberg hotlinking:
 * rewrites empty values and Gutenberg/mirror hostnames cleanly to same-origin R2
 * `/api/books/content?id=<bookId>&type=cover` while preserving `blob:`, `data:`,
 * custom relative paths, and custom third-party URLs.
 */
export function resolveBookCoverUrl(bookId: number, primaryUrl?: string | null): string | null {
  const trimmed = (primaryUrl || '').trim();
  if (!trimmed) {
    return buildR2CoverUrl(bookId);
  }

  if (trimmed.startsWith('blob:') || trimmed.startsWith('data:')) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    const isHttp = parsed.protocol === 'https:' || parsed.protocol === 'http:';
    if (isHttp && GUTENBERG_COVER_HOSTS.has(parsed.hostname.toLowerCase())) {
      return buildR2CoverUrl(bookId);
    }
  } catch {
    // Relative paths preserve direct same-origin loading
  }

  return trimmed;
}

const customTwMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      shadow: [
        {
          shadow: [
            'xs',
            '2xs',
            'book',
            'book-hover',
            'booksaw',
            'booksaw-hover',
            'modern-sm',
            'modern-md',
            'modern-hover',
            'spine',
            'shelf-ledge',
          ],
        },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return customTwMerge(clsx(inputs));
}

export interface BookFormatInfo {
  epub?: string;
  html?: string;
  txt?: string;
  mobi?: string;
  coverImage?: string;
  pdf?: string;
}

export interface SanitizeBookFormatUrlOptions {
  allowBlob?: boolean;
  allowInternalContentPath?: boolean;
}

/**
 * Validates external book format URLs against a strict protocol allowlist (`https:`,
 * local `blob:` only when explicitly enabled, and same-origin `/api/books/content` proxy
 * routes when `allowInternalContentPath` is enabled), rejecting dangerous pseudo-protocols
 * (`javascript:`, `data:`, `vbscript:`), protocol-relative `//` URLs, and plain `http:`.
 */
export function sanitizeBookFormatUrl(
  rawUrl?: string | null,
  options: SanitizeBookFormatUrlOptions = {}
): string | undefined {
  if (typeof rawUrl !== 'string') return undefined;
  const trimmed = rawUrl.trim();
  if (!trimmed) return undefined;
  if (
    options.allowInternalContentPath &&
    trimmed.startsWith('/') &&
    !trimmed.startsWith('//')
  ) {
    try {
      const parsedInternal = new URL(trimmed, 'https://bookarium.local');
      if (
        parsedInternal.origin === 'https://bookarium.local' &&
        parsedInternal.pathname === API_ENDPOINTS.INTERNAL_API_CONTENT
      ) {
        return trimmed;
      }
    } catch {
      return undefined;
    }
    return undefined;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:') {
      return trimmed;
    }
    if (options.allowBlob && parsed.protocol === 'blob:') {
      return trimmed;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

/**
 * Normalizes catalog format dictionaries to canonical R2/HTTPS format URLs.
 */
export function extractBookFormats(
  formats: Record<string, string> = {},
  bookId?: number
): BookFormatInfo {
  const result: BookFormatInfo = {};

  for (const [key, rawUrl] of Object.entries(formats || {})) {
    const isCoverKey = key.includes('image/jpeg') || key.includes('image/png');
    const isTextKey = key.includes('text/plain');
    const url = sanitizeBookFormatUrl(
      rawUrl,
      isCoverKey
        ? { allowBlob: true, allowInternalContentPath: true }
        : isTextKey
          ? { allowInternalContentPath: true }
          : undefined
    );
    if (!url) continue;

    if (key.includes('epub')) {
      result.epub = url;
    } else if (key.includes('text/html')) {
      result.html = url;
    } else if (isTextKey) {
      result.txt = url;
    } else if (key.includes('x-mobipocket-ebook') || key.includes('mobi')) {
      result.mobi = url;
    } else if (isCoverKey) {
      result.coverImage =
        bookId && bookId > 0 ? resolveBookCoverUrl(bookId, url) ?? url : url;
    } else if (key.includes('pdf')) {
      result.pdf = url;
    }
  }

  // Deterministic same-origin R2 defaults for active public domain assets
  if (bookId && bookId > 0) {
    if (!result.txt) {
      result.txt = buildR2TextUrl(bookId) ?? undefined;
    }
    if (!result.coverImage) {
      result.coverImage = buildR2CoverUrl(bookId) ?? undefined;
    }
  }

  return result;
}

/**
 * Formats a download count into a readable string (e.g. 15.2k).
 */
export function formatDownloadCount(count: number): string {
  if (count == null || isNaN(count)) return '0';
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  }
  return count.toString();
}

/**
 * Estimates reading time from character or word counts.
 */
export function calculateReadingTime(wordCount: number): string {
  if (!wordCount || wordCount <= 0) return '~1 hr';
  const wordsPerMinute = 220;
  const minutes = Math.ceil(wordCount / wordsPerMinute);
  if (minutes < 60) {
    return `${minutes} min read`;
  }
  const hours = (minutes / 60).toFixed(1).replace(/\.0$/, '');
  return `${hours} hrs read`;
}

/**
 * Truncates text cleanly on word boundaries with ellipsis.
 */
export function truncate(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text || '';
  const sub = text.slice(0, maxLength);
  const lastSpace = sub.lastIndexOf(' ');
  return (lastSpace > 0 ? sub.slice(0, lastSpace) : sub) + '...';
}

const LINEAGE_SUFFIX_REGEX = /^(jr\.?|sr\.?|père|fils|ii|iii|iv|v)$/i;

/**
 * Formats a raw author name (e.g. "Fitzgerald, F. Scott (Francis Scott)" or "Austen, Jane, 1775-1817")
 * into natural reading order (e.g. "F. Scott Fitzgerald", "Jane Austen", "Henry James, Jr.").
 */
export function formatAuthorName(rawName?: string): string {
  if (!rawName || typeof rawName !== 'string') return '';
  let cleaned = rawName;
  // Strip parenthesized expansions e.g. "(Francis Scott)", "(Samuel Clemens)"
  cleaned = cleaned.replace(/\s*\([^)]*\)/g, '').trim();
  // Strip bracketed expansions e.g. "[1896-1940]"
  cleaned = cleaned.replace(/\s*\[[^\]]*\]/g, '').trim();
  // Strip birth-death dates like ", 1775-1817", ", -428--348", ", 56-120"
  cleaned = cleaned.replace(/[\(\[\,]\s*-?\d{1,4}\s*[-–—]\s*-?\d{1,4}\s*[\)\]]?/g, '').trim();
  // Strip single-bound death/birth suffixes like ", d. 1817" or ", b. 1775"
  cleaned = cleaned.replace(/[\(\[\,]\s*(?:d\.|died|death|b\.|born|birth)\s*-?\d{1,4}\s*[\)\]]?/gi, '').trim();
  // Strip trailing punctuation
  cleaned = cleaned.replace(/[,;]+$/, '').trim();

  if (cleaned.includes(',')) {
    const parts = cleaned
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);

    if (parts.length >= 3 && LINEAGE_SUFFIX_REGEX.test(parts[parts.length - 1])) {
      const suffix = parts.pop()!;
      const surname = parts[0];
      const givenNames = parts.slice(1).join(' ');
      return `${givenNames} ${surname}, ${suffix}`;
    }

    return parts.reverse().join(' ');
  }
  return cleaned;
}

/**
 * Formats an array of authors (strings or author metadata objects) or raw author string
 * into a natural comma-separated string.
 */
export function formatAuthorNames(
  authors?: (string | { name: string } | { name?: string })[] | string
): string {
  if (!authors) return '';
  if (typeof authors === 'string') {
    return formatAuthorName(authors);
  }
  if (Array.isArray(authors) && authors.length > 0) {
    return authors
      .map((a) => {
        if (!a) return '';
        if (typeof a === 'string') return formatAuthorName(a);
        return formatAuthorName(a.name);
      })
      .filter(Boolean)
      .join(', ');
  }
  return '';
}

/**
 * Normalizes Library of Congress Subject Headings (LCSH) by stripping sub-divisions
 * (e.g. "Fiction -- Psychological aspects" -> "Fiction") and applying optional length truncation.
 */
export function formatPrimarySubject(
  subjects?: string[] | string | null,
  maxLength?: number
): string {
  if (!subjects) return 'Classic Literature';
  const first = Array.isArray(subjects) ? subjects[0] : subjects;
  if (!first || typeof first !== 'string') return 'Classic Literature';
  const cleaned = first.split('--')[0].trim();
  if (!cleaned) return 'Classic Literature';
  return maxLength ? truncate(cleaned, maxLength) : cleaned;
}

/**
 * Extracts a list of clean, unique subject tags from Library of Congress Subject Headings (LCSH),
 * stripping sub-divisions (e.g. "Fiction -- Psychological aspects" -> "Fiction") and deduplicating.
 */
export function extractBookTags(
  subjects?: string[] | string | null,
  maxTags = 2,
  maxTagLength = 18
): string[] {
  if (!subjects) return ['Classic Literature'];
  const rawList = Array.isArray(subjects) ? subjects : [subjects];
  const tags: string[] = [];
  const seen = new Set<string>();

  for (const raw of rawList) {
    if (!raw || typeof raw !== 'string') continue;
    const cleaned = raw.split('--')[0].trim();
    if (!cleaned) continue;
    const normalized = cleaned.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    tags.push(maxTagLength ? truncate(cleaned, maxTagLength) : cleaned);
    if (tags.length >= maxTags) break;
  }

  return tags.length > 0 ? tags : ['Classic Literature'];
}

/**
 * Formats an ISO date timestamp into a human-readable relative interval
 * (e.g. "Just now", "5m ago", "2h ago", "3d ago", or "Oct 12").
 * Safely falls back to "Recently" for invalid dates or epoch zero.
 */
export function formatRelativeTime(dateIso?: string | null): string {
  if (!dateIso || typeof dateIso !== 'string') return 'Recently';
  try {
    const timestamp = new Date(dateIso).getTime();
    if (!timestamp || Number.isNaN(timestamp) || timestamp <= 0) {
      return 'Recently';
    }
    const diffMs = Date.now() - timestamp;
    if (diffMs < 0) return 'Just now';
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(dateIso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return 'Recently';
  }
}

