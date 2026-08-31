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
export function extractBookFormats(formats: Record<string, string> = {}): BookFormatInfo {
  const result: BookFormatInfo = {};

  for (const [key, url] of Object.entries(formats)) {
    if (key.includes('epub')) {
      result.epub = url;
    } else if (key.includes('text/html') || key.includes('text/html; charset=utf-8')) {
      result.html = url;
    } else if (key.includes('text/plain') || key.includes('text/plain; charset=utf-8')) {
      result.txt = url;
    } else if (key.includes('x-mobipocket-ebook') || key.includes('mobi')) {
      result.mobi = url;
    } else if (key.includes('image/jpeg') || key.includes('image/png')) {
      result.coverImage = url;
    } else if (key.includes('pdf')) {
      result.pdf = url;
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

