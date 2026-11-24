/**
 * Centralized Site Branding, External Links & Storage Constants for Bookarium
 */

const DEFAULT_SITE_URL = 'https://bookarium.vercel.app';

/**
 * Normalizes an origin URL or bare hostname to a canonical origin (`https://<host>`),
 * returning `null` when blank or invalid.
 */
export function normalizeSiteOrigin(rawUrl?: string): string | null {
  const trimmed = (rawUrl || '').trim().replace(/\/+$/, '');
  if (!trimmed) return null;

  const withProtocol = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

/**
 * Dynamically resolves the canonical production site URL across explicit configuration
 * and Vercel's automatically populated Primary Domain system env variables.
 * Uses static property accesses so Next.js client bundles inline `NEXT_PUBLIC_*` vars.
 */
export function resolveSiteUrl(): string {
  return (
    normalizeSiteOrigin(process.env.NEXT_PUBLIC_SITE_URL) ||
    normalizeSiteOrigin(process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL) ||
    normalizeSiteOrigin(
      typeof window === 'undefined' ? process.env.VERCEL_PROJECT_PRODUCTION_URL : undefined
    ) ||
    DEFAULT_SITE_URL
  );
}

/**
 * Resolves the canonical hostname (plus optional port) from the active production URL.
 */
export function resolveSiteHost(): string {
  return new URL(resolveSiteUrl()).host;
}

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
  return resolveSiteUrl();
}

/**
 * Builds an authentic, Project Gutenberg-compliant User-Agent header string.
 * Defaults to `(+<resolvedRepoUrl>)` when contact email is blank or omitted, and cleanly
 * appends `; <email>` when `includeContactEmail` is enabled and `GUTENBERG_CONTACT_EMAIL` is set.
 */
export function buildDescriptiveUserAgent(
  appName = 'Bookarium-PublicDomain-Reader',
  version = '1.0',
  includeContactEmail = true
): string {
  const repoOrSiteUrl = resolveRepositoryUrl();
  const email = includeContactEmail ? (process.env.GUTENBERG_CONTACT_EMAIL || '').trim() : '';
  const contactPart = email ? `+${repoOrSiteUrl}; ${email}` : `+${repoOrSiteUrl}`;
  return `${appName}/${version} (${contactPart})`;
}

export function resolveGoogleSiteVerification(
  rawToken = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
): { google: string } | undefined {
  const trimmed = rawToken?.trim();
  return trimmed ? { google: trimmed } : undefined;
}

export const SITE_CONFIG = {
  NAME: 'Bookarium',
  READER_NAME: 'Reader',
  LOGO_TEXT: 'BOOKARIUM',
  TITLE: 'Bookarium',
  DESCRIPTION:
    'Free, open, zero-cost access to 70,000+ public domain literary classics from Project Gutenberg.',
  TAGLINE: 'Crafted with care for book lovers everywhere',

  // Canonical Domain & Production URL
  SITE_URL: resolveSiteUrl(),
  SITE_HOST: resolveSiteHost(),

  // Author & Repository Links
  GITHUB_PROFILE: 'https://github.com/calin-m',
  GITHUB_REPO: resolveRepositoryUrl(true),
  USER_AGENT: buildDescriptiveUserAgent('Bookarium-PublicDomain-Reader', '1.0', true),
  PUBLIC_USER_AGENT: buildDescriptiveUserAgent('Bookarium-PublicDomain-Reader', '1.0', false),

  // Support, Inquiries & Legal Intake (Configurable via NEXT_PUBLIC_LEGAL_CONTACT_FORM)
  LEGAL_CONTACT_FORM: process.env.NEXT_PUBLIC_LEGAL_CONTACT_FORM || '',

  // Public Domain Partners & Upstream Archives
  PROJECT_GUTENBERG: 'https://www.gutenberg.org',
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

export const SCHOLAR_BIO_MAX_LENGTH = 400;
export const SCHOLAR_BIO_BOOK_TITLE_MAX_LENGTH = 300;
export const SCHOLAR_BIO_BOOK_AUTHOR_MAX_LENGTH = 200;

export const STORAGE_KEYS = {
  BOOKSHELF: 'bookarium-bookshelf-storage',
  READER_SETTINGS: 'bookarium-reader-preferences',
  PREFERENCES: 'bookarium-navigation-preferences',
  THEME: 'bookarium-theme-preference',
  AUTH_HINT: 'bookarium-auth-hint',
  CLIENT_IP_SYNC: 'bookarium-client-ip-sync',
  PENDING_STORE_CLEANUP: 'bookarium-pending-store-cleanup',
  ANNOTATIONS: 'bookarium-annotations-storage',
  HABITS: 'bookarium-habits-storage',
  ACCOLADES: 'bookarium-accolades-storage',
} as const;
