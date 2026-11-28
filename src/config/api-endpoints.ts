/**
 * Centralized Internal API Endpoints for Bookarium
 * Provides a single source of truth for internal Next.js proxy routes
 * (all book texts and covers stream strictly from private Cloudflare R2 via /api/books/content).
 */

export const API_ENDPOINTS = {
  // Internal Next.js App Router API Proxies
  INTERNAL_API_BOOKS: '/api/books',
  INTERNAL_API_CONTENT: '/api/books/content',
} as const;
