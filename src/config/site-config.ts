/**
 * Centralized Site Branding, External Links & Storage Constants for Bookarium
 */

export const SITE_CONFIG = {
  NAME: 'Bookarium',
  LOGO_TEXT: 'BOOKARIUM',
  TITLE: 'Bookarium — Universal Public Domain Library & Reader',
  DESCRIPTION:
    'Free, open, zero-cost access to 70,000+ public domain literary classics from Project Gutenberg.',
  TAGLINE: 'Crafted with care for book lovers everywhere',

  // Author & Repository Links
  GITHUB_PROFILE: 'https://github.com/calin-m',
  GITHUB_REPO: 'https://github.com/calin-m/Bookarium',

  // Public Domain Partners & Upstream Providers
  PROJECT_GUTENBERG: 'https://www.gutenberg.org',
  GUTENDEX: 'https://gutendex.com',

  // External Canonical Dynamic Builders
  GUTENBERG_EBOOK: (id: number | string) =>
    `https://www.gutenberg.org/ebooks/${id}` as const,
} as const;

export const STORAGE_KEYS = {
  BOOKSHELF: 'bookarium-bookshelf-storage',
  READER_SETTINGS: 'bookarium-reader-preferences',
  PREFERENCES: 'bookarium-navigation-preferences',
  THEME: 'bookarium-theme-preference',
  ANNOTATIONS: 'bookarium-annotations-storage',
} as const;
