import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  SITE_CONFIG,
  STORAGE_KEYS,
  SCHOLAR_BIO_MAX_LENGTH,
  SCHOLAR_BIO_BOOK_TITLE_MAX_LENGTH,
  SCHOLAR_BIO_BOOK_AUTHOR_MAX_LENGTH,
  normalizeSiteOrigin,
  resolveSiteUrl,
  resolveSiteHost,
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
    expect(SITE_CONFIG.SITE_URL).toMatch(/^https?:\/\/.+/);
    expect(SITE_CONFIG.SITE_HOST).toBe(new URL(SITE_CONFIG.SITE_URL).host);
    expect(SITE_CONFIG.GITHUB_PROFILE).toBe('https://github.com/calin-m');
    expect(SITE_CONFIG.USER_AGENT).toContain('Bookarium-PublicDomain-Reader/1.0');
    expect(SITE_CONFIG.PUBLIC_USER_AGENT).toMatch(
      /^Bookarium-PublicDomain-Reader\/1\.0 \(\+https:\/\/[^;)]+\)$/
    );
    expect(SITE_CONFIG.PROJECT_GUTENBERG).toBe('https://www.gutenberg.org');
  });

  it('normalizes site origins and resolves canonical SITE_URL / SITE_HOST fallback chain', () => {
    expect(normalizeSiteOrigin('https://bookarium.ro/')).toBe('https://bookarium.ro');
    expect(normalizeSiteOrigin('  books.example.com///  ')).toBe('https://books.example.com');
    expect(normalizeSiteOrigin('http://localhost:3000/')).toBe('http://localhost:3000');
    expect(normalizeSiteOrigin('')).toBeNull();
    expect(normalizeSiteOrigin('   ')).toBeNull();
    expect(normalizeSiteOrigin('javascript:alert(1)')).toBeNull();
    expect(normalizeSiteOrigin('ftp://files.example.com')).toBeNull();
    expect(normalizeSiteOrigin('not a valid host name')).toBeNull();

    const prevSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    const prevPublicProd = process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;
    const prevServerProd = process.env.VERCEL_PROJECT_PRODUCTION_URL;

    try {
      delete process.env.NEXT_PUBLIC_SITE_URL;
      delete process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;
      delete process.env.VERCEL_PROJECT_PRODUCTION_URL;

      // Default fallback when no env overrides exist
      expect(resolveSiteUrl()).toBe('https://bookarium.vercel.app');
      expect(resolveSiteHost()).toBe('bookarium.vercel.app');

      // Browser-context skips server-only VERCEL_PROJECT_PRODUCTION_URL
      process.env.VERCEL_PROJECT_PRODUCTION_URL = 'server-only.example.com';
      expect(resolveSiteUrl()).toBe('https://bookarium.vercel.app');

      // Server-context picks up VERCEL_PROJECT_PRODUCTION_URL (bare hostname)
      vi.stubGlobal('window', undefined);
      expect(resolveSiteUrl()).toBe('https://server-only.example.com');
      expect(resolveSiteHost()).toBe('server-only.example.com');

      // NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL beats server-only var
      process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL = 'public-vercel.example.com/';
      expect(resolveSiteUrl()).toBe('https://public-vercel.example.com');
      expect(resolveSiteHost()).toBe('public-vercel.example.com');

      // Explicit NEXT_PUBLIC_SITE_URL wins over all Vercel fallbacks
      process.env.NEXT_PUBLIC_SITE_URL = 'https://bookarium.ro/';
      expect(resolveSiteUrl()).toBe('https://bookarium.ro');
      expect(resolveSiteHost()).toBe('bookarium.ro');

      // includeContactEmail=false omits GUTENBERG_CONTACT_EMAIL for public /copyright disclosure
      const prevEmail = process.env.GUTENBERG_CONTACT_EMAIL;
      const prevRepo = process.env.NEXT_PUBLIC_GITHUB_REPO;
      try {
        process.env.GUTENBERG_CONTACT_EMAIL = 'ops@bookarium.ro';
        process.env.NEXT_PUBLIC_GITHUB_REPO = 'https://bookarium.ro';
        expect(buildDescriptiveUserAgent('Bookarium-PublicDomain-Reader', '1.0', true)).toBe(
          'Bookarium-PublicDomain-Reader/1.0 (+https://bookarium.ro; ops@bookarium.ro)'
        );
        expect(buildDescriptiveUserAgent('Bookarium-PublicDomain-Reader', '1.0', false)).toBe(
          'Bookarium-PublicDomain-Reader/1.0 (+https://bookarium.ro)'
        );
      } finally {
        if (prevEmail === undefined) delete process.env.GUTENBERG_CONTACT_EMAIL;
        else process.env.GUTENBERG_CONTACT_EMAIL = prevEmail;
        if (prevRepo === undefined) delete process.env.NEXT_PUBLIC_GITHUB_REPO;
        else process.env.NEXT_PUBLIC_GITHUB_REPO = prevRepo;
      }
    } finally {
      vi.unstubAllGlobals();
      if (prevSiteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
      else process.env.NEXT_PUBLIC_SITE_URL = prevSiteUrl;
      if (prevPublicProd === undefined) delete process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;
      else process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL = prevPublicProd;
      if (prevServerProd === undefined) delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
      else process.env.VERCEL_PROJECT_PRODUCTION_URL = prevServerProd;
    }
  });

  it('dynamically resolves repository URL across environments without hardcoding personal usernames', () => {
    delete process.env.NEXT_PUBLIC_GITHUB_REPO;
    delete process.env.BOOKARIUM_REPO_URL;
    delete process.env.GITHUB_REPOSITORY;
    delete process.env.VERCEL_GIT_REPO_OWNER;
    delete process.env.VERCEL_GIT_REPO_SLUG;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;

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
    expect(STORAGE_KEYS.CLIENT_IP_SYNC).toBe('bookarium-client-ip-sync');
    expect(STORAGE_KEYS.PENDING_STORE_CLEANUP).toBe('bookarium-pending-store-cleanup');
    expect(STORAGE_KEYS.HABITS).toBe('bookarium-habits-storage');
    expect(STORAGE_KEYS.ACCOLADES).toBe('bookarium-accolades-storage');
    expect(SCHOLAR_BIO_MAX_LENGTH).toBe(400);
    expect(SCHOLAR_BIO_BOOK_TITLE_MAX_LENGTH).toBe(300);
    expect(SCHOLAR_BIO_BOOK_AUTHOR_MAX_LENGTH).toBe(200);
  });
});
