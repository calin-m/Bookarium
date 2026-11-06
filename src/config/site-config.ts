/**
 * Centralized Site Branding, External Links & Storage Constants for Bookarium
 */

/**
 * Dynamically resolves the canonical repository URL or site origin across environments
 * (explicit NEXT_PUBLIC_GITHUB_REPO, BOOKARIUM_REPO_URL, CI GITHUB_REPOSITORY, Vercel VERCEL_GIT_REPO_*, or site URL)
 * without hardcoding personal usernames.
 */
export function resolveRepositoryUrl(fallbackToGithub = false): string {
  if (process.env.NEXT_PUBLIC_GITHUB_REPO) {
    return process.env.NEXT_PUBLIC_GITHUB_REPO.trim();
  }
  if (process.env.BOOKARIUM_REPO_URL) {
    return process.env.BOOKARIUM_REPO_URL.trim();
  }
  if (process.env.GITHUB_REPOSITORY) {
    return `https://github.com/${process.env.GITHUB_REPOSITORY.trim().replace(/^\/+|\/+$/g, '')}`;
  }
  if (process.env.VERCEL_GIT_REPO_OWNER && process.env.VERCEL_GIT_REPO_SLUG) {
    return `https://github.com/${process.env.VERCEL_GIT_REPO_OWNER.trim()}/${process.env.VERCEL_GIT_REPO_SLUG.trim()}`;
  }
  if (fallbackToGithub) {
    return 'https://github.com/calin-m/Bookarium';
  }
  return process.env.NEXT_PUBLIC_SITE_URL || 'https://bookarium.vercel.app';
}

/**
 * Builds an authentic, Project Gutenberg-compliant User-Agent header string.
 * Defaults to `(+<resolvedRepoUrl>)` when contact email is blank, and cleanly
 * appends `; <email>` when GUTENBERG_CONTACT_EMAIL is configured.
 */
export function buildDescriptiveUserAgent(
  appName = 'Bookarium-PublicDomain-Reader',
  version = '1.0'
): string {
  const repoOrSiteUrl = resolveRepositoryUrl();
  const email = (process.env.GUTENBERG_CONTACT_EMAIL || '').trim();
  const contactPart = email ? `+${repoOrSiteUrl}; ${email}` : `+${repoOrSiteUrl}`;
  return `${appName}/${version} (${contactPart})`;
}

export const SITE_CONFIG = {
  NAME: 'Bookarium',
  LOGO_TEXT: 'BOOKARIUM',
  TITLE: 'Bookarium — Universal Public Domain Library & Reader',
  DESCRIPTION:
    'Free, open, zero-cost access to 70,000+ public domain literary classics from Project Gutenberg.',
  TAGLINE: 'Crafted with care for book lovers everywhere',

  // Canonical Domain & Production URL
  SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'https://bookarium.vercel.app',

  // Author & Repository Links
  GITHUB_PROFILE: 'https://github.com/calin-m',
  GITHUB_REPO: resolveRepositoryUrl(true),
  USER_AGENT: buildDescriptiveUserAgent('Bookarium-PublicDomain-Reader', '1.0'),

  // Support, Inquiries & Legal Intake (Configurable via NEXT_PUBLIC_LEGAL_CONTACT_FORM)
  LEGAL_CONTACT_FORM: process.env.NEXT_PUBLIC_LEGAL_CONTACT_FORM || '',

  // Public Domain Partners & Upstream Providers
  PROJECT_GUTENBERG: 'https://www.gutenberg.org',
  GUTENDEX: 'https://gutendex.com',
  WIKIDATA: 'https://www.wikidata.org',

  // Design Attribution & UI Foundation
  FIGMA_BOOKSAW:
    'https://www.figma.com/community/file/1521831984874247291/booksaw-bookstore-ecommerce-website-design-template',

  // AI Engineering & Co-Development
  GOOGLE_ANTIGRAVITY: 'https://antigravity.google',

  // External Canonical Dynamic Builders
  GUTENBERG_EBOOK: (id: number | string) =>
    `https://www.gutenberg.org/ebooks/${id}` as const,
} as const;

export const STORAGE_KEYS = {
  BOOKSHELF: 'bookarium-bookshelf-storage',
  READER_SETTINGS: 'bookarium-reader-preferences',
  PREFERENCES: 'bookarium-navigation-preferences',
  THEME: 'bookarium-theme-preference',
  AUTH_HINT: 'bookarium-auth-hint',
  ANNOTATIONS: 'bookarium-annotations-storage',
  HABITS: 'bookarium-habits-storage',
  ACCOLADES: 'bookarium-accolades-storage',
} as const;
