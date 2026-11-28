/**
 * Centralized Route Registry for Bookarium
 * Provides type-safe internal route builders, view targets, and canonical paths.
 *
 * @module src/config/routes
 * @scope Single source of truth (`ROUTES`) for static navigation views, parameterized reader/sanctuary builders (`READ`, `PUBLIC_PROFILE`), clean image gateways (`COVER_ASSET`, `OG_BOOK_CARD`), and internal API routes (`API_BOOKS`, `API_CONTENT`, `API_PROFILE_CARD`).
 * @invariant Normalize and URL-encode handles in `PUBLIC_PROFILE`, keep `/covers/<id>.jpg` (`COVER_ASSET`) and `/og/books/<id>.png` (`OG_BOOK_CARD`) synchronized with root crawler handlers, and map `'catalog'` cleanly to `'/'` inside `VIEW`.
 * @rationale Centralizing route templates prevents broken internal links across App Router transitions, crawlers, share cards, and ESLint open-redirect exemptions (`no-tainted-request-sink`).
 * @adr ADR-016, ADR-080, ADR-082
 */

export const ROUTES = {
  HOME: '/',
  CATALOG: '/',
  ACCOUNT: '/account',
  PROFILE: '/account',
  CONFIRM_DELETION: '/auth/confirm-deletion',
  AUTH_CALLBACK: '/auth/callback',
  PRIVACY: '/privacy',
  COPYRIGHT: '/copyright',

  // View Clean Path Targets
  BOOKSHELF: '/bookshelf',
  FAVORITES: '/favorites',
  NOTEBOOK: '/notebook',
  BOOKMARKS: '/bookmarks',

  // Dynamic Route Builders
  READ: (id: number | string) => `/read/${id}` as const,
  PUBLIC_PROFILE: (username: string) => `/u/${encodeURIComponent(username.toLowerCase().trim())}` as const,
  COVER_ASSET: (id: number | string) => `/covers/${id}.jpg` as const,
  OG_BOOK_CARD: (id: number | string, shareToken?: string | null) =>
    `/og/books/${id}.png${shareToken ? `?s=${encodeURIComponent(shareToken)}` : ''}`,
  VIEW: (view: 'catalog' | 'bookshelf' | 'favorites' | 'notebook' | 'bookmarks') =>
    (view === 'catalog' ? '/' : (`/${view}` as const)),

  // API Proxy Routes
  API_BOOKS: '/api/books',
  API_CONTENT: '/api/books/content',
  API_PROFILE_CARD: '/api/profiles/card',
} as const;

