import { describe, it, expect } from 'vitest';
import sitemap, { FEATURED_CLASSIC_BOOK_IDS } from './sitemap';
import { SITE_CONFIG } from '@/config/site-config';

describe('sitemap() route handler', () => {
  it('generates canonical sitemap entries for root and privacy routes', () => {
    const entries = sitemap();

    const rootEntry = entries.find((e) => e.url === SITE_CONFIG.SITE_URL);
    expect(rootEntry).toBeDefined();
    expect(rootEntry?.priority).toBe(1.0);
    expect(rootEntry?.changeFrequency).toBe('daily');

    const privacyEntry = entries.find((e) => e.url === `${SITE_CONFIG.SITE_URL}/privacy`);
    expect(privacyEntry).toBeDefined();
    expect(privacyEntry?.priority).toBe(0.5);
    expect(privacyEntry?.changeFrequency).toBe('monthly');
  });

  it('indexes featured public domain classic books', () => {
    const entries = sitemap();

    for (const id of FEATURED_CLASSIC_BOOK_IDS) {
      const bookEntry = entries.find((e) => e.url === `${SITE_CONFIG.SITE_URL}/read/${id}`);
      expect(bookEntry).toBeDefined();
      expect(bookEntry?.priority).toBe(0.8);
      expect(bookEntry?.changeFrequency).toBe('weekly');
    }
  });

  it('provides valid timestamps across all entries', () => {
    const entries = sitemap();
    expect(entries.length).toBeGreaterThan(FEATURED_CLASSIC_BOOK_IDS.length);

    for (const entry of entries) {
      expect(entry.url).toMatch(/^https?:\/\//);
      expect(entry.lastModified).toBeInstanceOf(Date);
    }
  });
});

