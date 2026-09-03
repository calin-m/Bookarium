import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export interface BookFormatInfo {
  epub?: string;
  html?: string;
  txt?: string;
  mobi?: string;
  coverImage?: string;
  pdf?: string;
}

/**
 * Normalizes Gutendex format dictionaries to canonical format URLs.
 */
export function extractBookFormats(
  formats: Record<string, string> = {},
  bookId?: number
): BookFormatInfo {
  const result: BookFormatInfo = {};

  for (const [key, url] of Object.entries(formats)) {
    if (key.includes('epub')) {
      result.epub = url;
    } else if (key.includes('text/html')) {
      result.html = url;
    } else if (key.includes('text/plain')) {
      result.txt = url;
    } else if (key.includes('x-mobipocket-ebook') || key.includes('mobi')) {
      result.mobi = url;
    } else if (key.includes('image/jpeg') || key.includes('image/png')) {
      result.coverImage = url;
    } else if (key.includes('pdf')) {
      result.pdf = url;
    }
  }

  // Canonical Project Gutenberg fallback URLs for standard public domain books
  if (bookId && bookId > 0) {
    if (!result.epub) {
      result.epub = `https://www.gutenberg.org/ebooks/${bookId}.epub3.images`;
    }
    if (!result.html) {
      result.html = `https://www.gutenberg.org/ebooks/${bookId}.html.images`;
    }
    if (!result.txt) {
      result.txt = `https://www.gutenberg.org/ebooks/${bookId}.txt.utf-8`;
    }
    if (!result.mobi) {
      result.mobi = `https://www.gutenberg.org/ebooks/${bookId}.kindle.images`;
    }
    if (!result.coverImage) {
      result.coverImage = `https://www.gutenberg.org/cache/epub/${bookId}/pg${bookId}.cover.medium.jpg`;
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

/**
 * Formats a raw author name (e.g. "Fitzgerald, F. Scott (Francis Scott)" or "Austen, Jane, 1775-1817")
 * into natural reading order (e.g. "F. Scott Fitzgerald", "Jane Austen").
 */
export function formatAuthorName(rawName?: string): string {
  if (!rawName || typeof rawName !== 'string') return '';
  let cleaned = rawName;
  // Strip parenthesized expansions e.g. "(Francis Scott)", "(Samuel Clemens)"
  cleaned = cleaned.replace(/\s*\([^)]*\)/g, '').trim();
  // Strip bracketed expansions e.g. "[1896-1940]"
  cleaned = cleaned.replace(/\s*\[[^\]]*\]/g, '').trim();
  // Strip birth-death dates like ", 1775-1817"
  cleaned = cleaned.replace(/[\(\[\,]\s*\d{3,4}\s*[-–—]\s*\d{3,4}\s*[\)\]]?/g, '').trim();
  // Strip trailing punctuation
  cleaned = cleaned.replace(/[,;]+$/, '').trim();

  if (cleaned.includes(',')) {
    return cleaned
      .split(',')
      .map((part) => part.trim())
      .reverse()
      .filter(Boolean)
      .join(' ');
  }
  return cleaned;
}

/**
 * Formats an array of authors or raw author string into a natural comma-separated string.
 */
export function formatAuthorNames(authors?: { name: string }[] | string): string {
  if (!authors) return '';
  if (typeof authors === 'string') {
    return formatAuthorName(authors);
  }
  if (Array.isArray(authors) && authors.length > 0) {
    return authors
      .map((a) => formatAuthorName(a.name))
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

