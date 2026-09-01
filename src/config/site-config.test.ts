import { describe, it, expect } from 'vitest';
import { SITE_CONFIG, STORAGE_KEYS } from './site-config';

describe('SITE_CONFIG & STORAGE_KEYS', () => {
  it('provides site branding and metadata constants', () => {
    expect(SITE_CONFIG.NAME).toBe('Bookarium');
    expect(SITE_CONFIG.LOGO_TEXT).toBe('BOOKARIUM');
    expect(SITE_CONFIG.TAGLINE).toBe('Crafted with care for book lovers everywhere');
    expect(SITE_CONFIG.GITHUB_PROFILE).toBe('https://github.com/calin-m');
    expect(SITE_CONFIG.PROJECT_GUTENBERG).toBe('https://www.gutenberg.org');
    expect(SITE_CONFIG.GUTENDEX).toBe('https://gutendex.com');
  });

  it('builds canonical Gutenberg ebook URL', () => {
    expect(SITE_CONFIG.GUTENBERG_EBOOK(1342)).toBe('https://www.gutenberg.org/ebooks/1342');
  });

  it('provides persistent storage keys', () => {
    expect(STORAGE_KEYS.BOOKSHELF).toBe('bookarium-bookshelf-storage');
    expect(STORAGE_KEYS.READER_SETTINGS).toBe('bookarium-reader-preferences');
    expect(STORAGE_KEYS.PREFERENCES).toBe('bookarium-navigation-preferences');
    expect(STORAGE_KEYS.THEME).toBe('bookarium-theme-preference');
  });
});
