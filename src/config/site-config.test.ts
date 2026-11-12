import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  SITE_CONFIG,
  STORAGE_KEYS,
  resolveRepositoryUrl,
  buildDescriptiveUserAgent,
  resolveGoogleSiteVerification,
} from './site-config';

describe('SITE_CONFIG & STORAGE_KEYS', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('provides site branding and metadata constants', () => {
    expect(SITE_CONFIG.NAME).toBe('Bookarium');
    expect(SITE_CONFIG.READER_NAME).toBe('Reader');
    expect(SITE_CONFIG.TITLE).toBe('Bookarium');
    expect(SITE_CONFIG.LOGO_TEXT).toBe('BOOKARIUM');
    expect(SITE_CONFIG.TAGLINE).toBe('Crafted with care for book lovers everywhere');
    expect(SITE_CONFIG.GITHUB_PROFILE).toBe('https://github.com/calin-m');
    expect(SITE_CONFIG.USER_AGENT).toContain('Bookarium-PublicDomain-Reader/1.0');
    expect(SITE_CONFIG.PROJECT_GUTENBERG).toBe('https://www.gutenberg.org');
    expect(SITE_CONFIG.GUTENDEX).toBe('https://gutendex.com');
  });

  it('dynamically resolves repository URL across environments without hardcoding personal usernames', () => {
    delete process.env.NEXT_PUBLIC_GITHUB_REPO;
    delete process.env.BOOKARIUM_REPO_URL;
    delete process.env.GITHUB_REPOSITORY;
    delete process.env.VERCEL_GIT_REPO_OWNER;
    delete process.env.VERCEL_GIT_REPO_SLUG;
    delete process.env.NEXT_PUBLIC_SITE_URL;

    // 1. Clean default fallback to site domain
    expect(resolveRepositoryUrl()).toBe('https://bookarium.vercel.app');

    // 2. Clean fallback to GitHub when fallbackToGithub is enabled
    expect(resolveRepositoryUrl(true)).toBe('https://github.com/calin-m/Bookarium');

    // 3. Custom NEXT_PUBLIC_SITE_URL fallback
    process.env.NEXT_PUBLIC_SITE_URL = 'https://custom-library.app';
    expect(resolveRepositoryUrl()).toBe('https://custom-library.app');

    // 4. Vercel deployment owner/slug
    process.env.VERCEL_GIT_REPO_OWNER = 'open-source-org';
    process.env.VERCEL_GIT_REPO_SLUG = 'public-books';
    expect(resolveRepositoryUrl()).toBe('https://github.com/open-source-org/public-books');

    // 5. GitHub Actions CI GITHUB_REPOSITORY (higher precedence)
    process.env.GITHUB_REPOSITORY = 'acme-corp/reader-fork';
    expect(resolveRepositoryUrl()).toBe('https://github.com/acme-corp/reader-fork');

    // 6. Explicit BOOKARIUM_REPO_URL override
    process.env.BOOKARIUM_REPO_URL = 'https://gitlab.com/custom/repo';
    expect(resolveRepositoryUrl()).toBe('https://gitlab.com/custom/repo');

    // 7. Explicit NEXT_PUBLIC_GITHUB_REPO override (highest precedence)
    process.env.NEXT_PUBLIC_GITHUB_REPO = 'https://github.com/my-org/my-bookarium';
    expect(resolveRepositoryUrl()).toBe('https://github.com/my-org/my-bookarium');
  });

  it('builds Project Gutenberg-compliant descriptive User-Agent strings with optional contact email', () => {
    delete process.env.BOOKARIUM_REPO_URL;
    delete process.env.GITHUB_REPOSITORY;
    delete process.env.GUTENBERG_CONTACT_EMAIL;
    process.env.NEXT_PUBLIC_SITE_URL = 'https://bookarium.vercel.app';

    // Blank email defaults to repository or site link
    const uaWithoutEmail = buildDescriptiveUserAgent('Bookarium-Reader', '2.0');
    expect(uaWithoutEmail).toBe('Bookarium-Reader/2.0 (+https://bookarium.vercel.app)');

    // Configured email is cleanly appended
    process.env.GUTENBERG_CONTACT_EMAIL = 'contact@example.org';
    const uaWithEmail = buildDescriptiveUserAgent('Bookarium-Reader', '2.0');
    expect(uaWithEmail).toBe('Bookarium-Reader/2.0 (+https://bookarium.vercel.app; contact@example.org)');
  });

  it('builds canonical Gutenberg ebook URL and defines legal intake form property', () => {
    expect(SITE_CONFIG.GUTENBERG_EBOOK(1342)).toBe('https://www.gutenberg.org/ebooks/1342');
    expect(SITE_CONFIG.GUTENBERG_EBOOK('84')).toBe('https://www.gutenberg.org/ebooks/84');
    expect(typeof SITE_CONFIG.LEGAL_CONTACT_FORM).toBe('string');
    expect(resolveGoogleSiteVerification('  token-123  ')).toEqual({ google: 'token-123' });
    expect(resolveGoogleSiteVerification('')).toBeUndefined();
  });

  it('provides persistent storage keys', () => {
    expect(STORAGE_KEYS.BOOKSHELF).toBe('bookarium-bookshelf-storage');
    expect(STORAGE_KEYS.READER_SETTINGS).toBe('bookarium-reader-preferences');
    expect(STORAGE_KEYS.PREFERENCES).toBe('bookarium-navigation-preferences');
    expect(STORAGE_KEYS.THEME).toBe('bookarium-theme-preference');
    expect(STORAGE_KEYS.AUTH_HINT).toBe('bookarium-auth-hint');
    expect(STORAGE_KEYS.HABITS).toBe('bookarium-habits-storage');
    expect(STORAGE_KEYS.ACCOLADES).toBe('bookarium-accolades-storage');
  });
});
