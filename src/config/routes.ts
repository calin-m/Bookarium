/**
 * Centralized Route Registry for Bookarium
 * Provides type-safe internal route builders, view targets, and canonical paths.
 */

export const ROUTES = {
  HOME: '/',
  CATALOG: '/',
  ACCOUNT: '/account',
  PROFILE: '/account',
  CONFIRM_DELETION: '/auth/confirm-deletion',
  AUTH_CALLBACK: '/auth/callback',
  PRIVACY: '/privacy',

  // View Query Targets
  BOOKSHELF: '/?view=bookshelf',
  LIKES: '/?view=likes',

  // Dynamic Route Builders
  READ: (id: number | string) => `/read/${id}` as const,
  VIEW: (view: 'catalog' | 'bookshelf' | 'likes') =>
    (view === 'catalog' ? '/' : `/?view=${view}` as const),

  // API Proxy Routes
  API_BOOKS: '/api/books',
  API_CONTENT: '/api/books/content',
} as const;

