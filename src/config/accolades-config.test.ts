import { describe, it, expect } from 'vitest';
import {
  ACCOLADE_TIER_CONFIG,
  ACCOLADE_CATEGORIES,
  ACCOLADES_CATALOG,
} from './accolades-config';

describe('src/config/accolades-config', () => {
  it('defines complete visual token mappings for all 4 accolade tiers', () => {
    const tiers = ['bronze', 'silver', 'gold', 'masterwork'] as const;
    for (const tier of tiers) {
      const tokens = ACCOLADE_TIER_CONFIG[tier];
      expect(tokens.name.length).toBeGreaterThan(0);
      expect(tokens.sealColor).toMatch(/^#[0-9a-f]{6}$/i);
      expect(tokens.badgeBg).toBeTruthy();
      expect(tokens.cardBorder).toBeTruthy();
    }
  });

  it('defines all 6 filter categories starting with "all"', () => {
    expect(ACCOLADE_CATEGORIES.map((c) => c.id)).toEqual([
      'all',
      'streaks',
      'immersion',
      'exploration',
      'scholarship',
      'curation',
    ]);
  });

  it('evaluates all 14 bookplate accolades accurately across empty and populated contexts', () => {
    expect(ACCOLADES_CATALOG).toHaveLength(14);

    for (const def of ACCOLADES_CATALOG) {
      expect(def.evaluate({})).toBe(0);
    }

    const richContext = {
      currentStreak: 14,
      longestStreak: 105,
      totalReadingSeconds: 72000, // 20 hours
      totalListeningSeconds: 21600, // 6 hours
      hasCompletedAncientBook: true,
      historicalErasExplored: ['antiquity', 'renaissance', 'romanticism', 'victorian'],
      totalAnnotationsCount: 18,
      highlightColorsUsed: ['canary', 'amber', 'mint', 'rose', 'canary'],
      completedSymposiumsCount: 2,
      completedBooksCount: 55,
    };

    const byId = Object.fromEntries(
      ACCOLADES_CATALOG.map((d) => [d.id, d.evaluate(richContext)])
    );

    expect(byId['seven-day-sage']).toBe(105);
    expect(byId['equinox-scholar']).toBe(105);
    expect(byId['centurion-of-letters']).toBe(105);
    expect(byId['the-marathon-reader']).toBe(26);
    expect(byId['audio-ascetic']).toBe(6);
    expect(byId['ancient-antiquarian']).toBe(1);
    expect(byId['century-voyager']).toBe(4);
    expect(byId['commonplace-scholar']).toBe(18);
    expect(byId['palette-virtuoso']).toBe(4);
    expect(byId['symposium-companion']).toBe(2);
    expect(byId['bibliophile-novice']).toBe(55);
    expect(byId['canonical-scholar']).toBe(55);
    expect(byId['master-of-the-canon']).toBe(55);
    expect(byId['the-laureates-crown']).toBe(55);
  });
});

