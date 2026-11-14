/**
 * Centralized API & Content Endpoints for Bookarium
 * Provides a single source of truth for Project Gutenberg raw text and EPUB storage
 * mirrors and internal Next.js proxy routes.
 */

export const API_ENDPOINTS = {
  // Project Gutenberg CDN Cache & Raw Text Mirrors
  GUTENBERG_CACHE_BASE_URL: 'https://www.gutenberg.org/cache/epub',
  GUTENBERG_FILES_BASE_URL: 'https://www.gutenberg.org/files',

  // Internal Next.js App Router API Proxies
  INTERNAL_API_BOOKS: '/api/books',
  INTERNAL_API_CONTENT: '/api/books/content',
} as const;
