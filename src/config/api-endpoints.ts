/**
 * Centralized API & Content Endpoints for Bookarium
 * Provides single source of truth for upstream Gutendex REST endpoints,
 * Project Gutenberg raw text and EPUB storage, and internal proxy routes.
 */

export const API_ENDPOINTS = {
  // Upstream Gutendex REST API
  GUTENDEX_BASE_URL: process.env.GUTENDEX_API_URL || 'https://gutendex.com/books',

  // Project Gutenberg CDN Cache & Raw Text Mirrors
  GUTENBERG_CACHE_BASE_URL: 'https://www.gutenberg.org/cache/epub',
  GUTENBERG_FILES_BASE_URL: 'https://www.gutenberg.org/files',

  // Internal Next.js App Router API Proxies
  INTERNAL_API_BOOKS: '/api/books',
  INTERNAL_API_CONTENT: '/api/books/content',
} as const;
