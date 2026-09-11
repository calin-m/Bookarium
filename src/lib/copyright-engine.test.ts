import { describe, it, expect } from 'vitest';
import {
  isBookPublicDomainInJurisdiction,
  getJurisdictionRule,
  normalizeCountryCode,
  getJurisdictionRuleDescription,
  EU_MEMBER_STATES,
  LIFE_70_COUNTRIES,
  LIFE_100_COUNTRIES,
  LIFE_80_COUNTRIES,
  US_JURISDICTIONS,
} from './copyright-engine';
import type { GutendexBook, Book } from '@/types/book.types';

describe('copyright-engine', () => {
  const currentYear = 2026;

  describe('normalizeCountryCode', () => {
    it('normalizes valid 2-letter codes to uppercase', () => {
      expect(normalizeCountryCode('gb')).toBe('GB');
      expect(normalizeCountryCode('us')).toBe('US');
      expect(normalizeCountryCode('mx')).toBe('MX');
      expect(normalizeCountryCode(' de ')).toBe('DE');
    });

    it('defaults null, undefined, or empty values to US', () => {
      expect(normalizeCountryCode(null)).toBe('US');
      expect(normalizeCountryCode(undefined)).toBe('US');
      expect(normalizeCountryCode('')).toBe('US');
      expect(normalizeCountryCode('   ')).toBe('US');
    });
  });

  describe('getJurisdictionRule', () => {
    it('identifies US jurisdictions', () => {
      expect(getJurisdictionRule('US')).toBe('US_PUBLIC_DOMAIN');
      expect(getJurisdictionRule('PR')).toBe('US_PUBLIC_DOMAIN');
      expect(getJurisdictionRule('VI')).toBe('US_PUBLIC_DOMAIN');
    });

    it('identifies Life + 100 jurisdictions', () => {
      expect(getJurisdictionRule('MX')).toBe('LIFE_100');
      expect(getJurisdictionRule('CI')).toBe('LIFE_100');
    });

    it('identifies Life + 80 jurisdictions', () => {
      expect(getJurisdictionRule('CO')).toBe('LIFE_80');
      expect(getJurisdictionRule('ES')).toBe('LIFE_80');
    });

    it('identifies Life + 70 EU and non-EU jurisdictions', () => {
      expect(getJurisdictionRule('GB')).toBe('LIFE_70');
      expect(getJurisdictionRule('DE')).toBe('LIFE_70');
      expect(getJurisdictionRule('FR')).toBe('LIFE_70');
      expect(getJurisdictionRule('CA')).toBe('LIFE_70');
      expect(getJurisdictionRule('AU')).toBe('LIFE_70');
      expect(getJurisdictionRule('JP')).toBe('LIFE_70');
    });

    it('defaults unknown or unmapped international countries to Life + 70', () => {
      expect(getJurisdictionRule('ZZ')).toBe('LIFE_70');
      expect(getJurisdictionRule('XY')).toBe('LIFE_70');
    });
  });

  describe('isBookPublicDomainInJurisdiction - Literary Authors & Jurisdictions', () => {
    const agathaChristieBook: GutendexBook = {
      id: 863,
      title: 'The Mysterious Affair at Styles',
      authors: [{ name: 'Christie, Agatha', birth_year: 1890, death_year: 1976 }],
      translators: [],
      subjects: ['Detective and mystery stories'],
      bookshelves: [],
      languages: ['en'],
      copyright: false,
      media_type: 'Text',
      formats: {},
      download_count: 5000,
    };

    const ernestHemingwayBook: GutendexBook = {
      id: 67138,
      title: 'The Sun Also Rises',
      authors: [{ name: 'Hemingway, Ernest', birth_year: 1899, death_year: 1961 }],
      translators: [],
      subjects: ['Fiction'],
      bookshelves: [],
      languages: ['en'],
      copyright: false,
      media_type: 'Text',
      formats: {},
      download_count: 4000,
    };

    const fScottFitzgeraldBook: GutendexBook = {
      id: 64317,
      title: 'The Great Gatsby',
      authors: [{ name: 'Fitzgerald, F. Scott (Francis Scott)', birth_year: 1896, death_year: 1940 }],
      translators: [],
      subjects: ['Fiction'],
      bookshelves: [],
      languages: ['en'],
      copyright: false,
      media_type: 'Text',
      formats: {},
      download_count: 10000,
    };

    const arthurConanDoyleBook: GutendexBook = {
      id: 1661,
      title: 'The Adventures of Sherlock Holmes',
      authors: [{ name: 'Doyle, Arthur Conan', birth_year: 1859, death_year: 1930 }],
      translators: [],
      subjects: ['Detective and mystery stories'],
      bookshelves: [],
      languages: ['en'],
      copyright: false,
      media_type: 'Text',
      formats: {},
      download_count: 8000,
    };

    const janeAustenBook: GutendexBook = {
      id: 1342,
      title: 'Pride and Prejudice',
      authors: [{ name: 'Austen, Jane', birth_year: 1775, death_year: 1817 }],
      translators: [],
      subjects: ['Courtship -- Fiction'],
      bookshelves: [],
      languages: ['en'],
      copyright: false,
      media_type: 'Text',
      formats: {},
      download_count: 20000,
    };

    it('evaluates Agatha Christie (d. 1976): Allowed in US, Blocked in GB/EU and MX', () => {
      // US: Allowed (published 1920 <= 1930)
      const usResult = isBookPublicDomainInJurisdiction(agathaChristieBook, 'US', currentYear);
      expect(usResult.isAllowed).toBe(true);
      expect(usResult.rule).toBe('US_PUBLIC_DOMAIN');

      // GB (Life + 70): Blocked until 1976 + 71 = 2047
      const gbResult = isBookPublicDomainInJurisdiction(agathaChristieBook, 'GB', currentYear);
      expect(gbResult.isAllowed).toBe(false);
      expect(gbResult.rule).toBe('LIFE_70');
      expect(gbResult.publicDomainYear).toBe(2047);
      expect(gbResult.restrictingDeathYear).toBe(1976);
      expect(gbResult.restrictingAuthor).toContain('Christie, Agatha');

      // MX (Life + 100): Blocked until 1976 + 101 = 2077
      const mxResult = isBookPublicDomainInJurisdiction(agathaChristieBook, 'MX', currentYear);
      expect(mxResult.isAllowed).toBe(false);
      expect(mxResult.rule).toBe('LIFE_100');
      expect(mxResult.publicDomainYear).toBe(2077);
    });

    it('evaluates Ernest Hemingway (d. 1961): Allowed in US, Blocked in GB/CA/AU and MX', () => {
      // US: Allowed
      const usResult = isBookPublicDomainInJurisdiction(ernestHemingwayBook, 'US', currentYear);
      expect(usResult.isAllowed).toBe(true);

      // GB (Life + 70): Blocked until 1961 + 71 = 2032
      const gbResult = isBookPublicDomainInJurisdiction(ernestHemingwayBook, 'GB', currentYear);
      expect(gbResult.isAllowed).toBe(false);
      expect(gbResult.publicDomainYear).toBe(2032);

      // MX (Life + 100): Blocked until 1961 + 101 = 2062
      const mxResult = isBookPublicDomainInJurisdiction(ernestHemingwayBook, 'MX', currentYear);
      expect(mxResult.isAllowed).toBe(false);
      expect(mxResult.publicDomainYear).toBe(2062);
    });

    it('evaluates F. Scott Fitzgerald (d. 1940): Allowed in US and GB, but Blocked in Mexico (Life + 100)', () => {
      // US: Allowed
      const usResult = isBookPublicDomainInJurisdiction(fScottFitzgeraldBook, 'US', currentYear);
      expect(usResult.isAllowed).toBe(true);

      // GB (Life + 70): Allowed (entered public domain in 1940 + 71 = 2011)
      const gbResult = isBookPublicDomainInJurisdiction(fScottFitzgeraldBook, 'GB', currentYear);
      expect(gbResult.isAllowed).toBe(true);

      // MX (Life + 100): Blocked until 1940 + 101 = 2041
      const mxResult = isBookPublicDomainInJurisdiction(fScottFitzgeraldBook, 'MX', currentYear);
      expect(mxResult.isAllowed).toBe(false);
      expect(mxResult.publicDomainYear).toBe(2041);
    });

    it('evaluates Arthur Conan Doyle (d. 1930): Allowed in US and GB, but Blocked in Mexico (Life + 100)', () => {
      // GB (Life + 70): Allowed (1930 + 71 = 2001)
      const gbResult = isBookPublicDomainInJurisdiction(arthurConanDoyleBook, 'GB', currentYear);
      expect(gbResult.isAllowed).toBe(true);

      // MX (Life + 100): Blocked until 1930 + 101 = 2031
      const mxResult = isBookPublicDomainInJurisdiction(arthurConanDoyleBook, 'MX', currentYear);
      expect(mxResult.isAllowed).toBe(false);
      expect(mxResult.publicDomainYear).toBe(2031);
    });

    it('evaluates Jane Austen (d. 1817): Allowed globally', () => {
      expect(isBookPublicDomainInJurisdiction(janeAustenBook, 'US', currentYear).isAllowed).toBe(true);
      expect(isBookPublicDomainInJurisdiction(janeAustenBook, 'GB', currentYear).isAllowed).toBe(true);
      expect(isBookPublicDomainInJurisdiction(janeAustenBook, 'DE', currentYear).isAllowed).toBe(true);
      expect(isBookPublicDomainInJurisdiction(janeAustenBook, 'MX', currentYear).isAllowed).toBe(true);
      expect(isBookPublicDomainInJurisdiction(janeAustenBook, 'CO', currentYear).isAllowed).toBe(true);
    });
  });

  describe('Joint Authorship (Berne Art. 7bis)', () => {
    it('withholds work if any co-author died within the regional copyright period', () => {
      const jointBook: GutendexBook = {
        id: 99999,
        title: 'Collaborative Treatise',
        authors: [
          { name: 'Early Author', birth_year: 1850, death_year: 1910 }, // Expired
          { name: 'Late Author', birth_year: 1895, death_year: 1968 },  // Protected in Life + 70 until 2040
        ],
        translators: [],
        subjects: [],
        bookshelves: [],
        languages: ['en'],
        copyright: false,
        media_type: 'Text',
        formats: {},
        download_count: 100,
      };

      const gbResult = isBookPublicDomainInJurisdiction(jointBook, 'GB', currentYear);
      expect(gbResult.isAllowed).toBe(false);
      expect(gbResult.restrictingAuthor).toContain('Late Author');
      expect(gbResult.publicDomainYear).toBe(2039);
    });
  });

  describe('Translators (Berne Art. 2(3))', () => {
    it('withholds ancient work if modern translator died within regional term', () => {
      const translatedPlato: GutendexBook = {
        id: 1497,
        title: 'The Republic',
        authors: [{ name: 'Plato', birth_year: -428, death_year: -348 }],
        translators: [{ name: 'Modern Scholar', birth_year: 1888, death_year: 1965 }], // Protected in Life+70 until 2036
        subjects: [],
        bookshelves: [],
        languages: ['en'],
        copyright: false,
        media_type: 'Text',
        formats: {},
        download_count: 500,
      };

      const gbResult = isBookPublicDomainInJurisdiction(translatedPlato, 'GB', currentYear);
      expect(gbResult.isAllowed).toBe(false);
      expect(gbResult.restrictingAuthor).toContain('Modern Scholar (translator)');
      expect(gbResult.publicDomainYear).toBe(2036);
    });

    it('allows ancient work if translator died long ago', () => {
      const historicalPlato: GutendexBook = {
        id: 1498,
        title: 'The Republic',
        authors: [{ name: 'Plato', birth_year: -428, death_year: -348 }],
        translators: [{ name: 'Benjamin Jowett', birth_year: 1817, death_year: 1893 }], // 1893 + 71 = 1964
        subjects: [],
        bookshelves: [],
        languages: ['en'],
        copyright: false,
        media_type: 'Text',
        formats: {},
        download_count: 500,
      };

      expect(isBookPublicDomainInJurisdiction(historicalPlato, 'GB', currentYear).isAllowed).toBe(true);
      expect(isBookPublicDomainInJurisdiction(historicalPlato, 'MX', currentYear).isAllowed).toBe(true);
    });
  });

  describe('Longevity Heuristic for Missing Death Years', () => {
    it('blocks author born in 1890 with null death year in Life + 70', () => {
      const unlistedDeathAuthor: GutendexBook = {
        id: 12345,
        title: 'Mysterious Novel',
        authors: [{ name: 'Obscure Writer', birth_year: 1890, death_year: null }],
        translators: [],
        subjects: [],
        bookshelves: [],
        languages: ['en'],
        copyright: false,
        media_type: 'Text',
        formats: {},
        download_count: 50,
      };

      const gbResult = isBookPublicDomainInJurisdiction(unlistedDeathAuthor, 'GB', currentYear);
      expect(gbResult.isAllowed).toBe(false);
      expect(gbResult.reason).toContain('does not guarantee contributor died >= 70 years ago');
    });

    it('clears author born in 1840 with null death year in Life + 70', () => {
      const ancientAuthor: GutendexBook = {
        id: 12346,
        title: 'Victorian Chronicle',
        // 2026 - 70 - 100 - 1 = 1855. Born in 1840 means they could at most have lived to 1940 (died 86 years ago).
        authors: [{ name: 'Early Victorian', birth_year: 1840, death_year: null }],
        translators: [],
        subjects: [],
        bookshelves: [],
        languages: ['en'],
        copyright: false,
        media_type: 'Text',
        formats: {},
        download_count: 50,
      };

      const gbResult = isBookPublicDomainInJurisdiction(ancientAuthor, 'GB', currentYear);
      expect(gbResult.isAllowed).toBe(true);
    });

    it('withholds book outside US if both birth and death years are null (fail-closed)', () => {
      const anonymousAuthor: GutendexBook = {
        id: 12347,
        title: 'Folklore of the Highlands',
        authors: [{ name: 'Anonymous Chronicler', birth_year: null, death_year: null }],
        translators: [],
        subjects: [],
        bookshelves: [],
        languages: ['en'],
        copyright: false,
        media_type: 'Text',
        formats: {},
        download_count: 50,
      };

      // Allowed in US (Project Gutenberg US cleared)
      expect(isBookPublicDomainInJurisdiction(anonymousAuthor, 'US', currentYear).isAllowed).toBe(true);

      // Blocked in GB (fail-closed)
      const gbResult = isBookPublicDomainInJurisdiction(anonymousAuthor, 'GB', currentYear);
      expect(gbResult.isAllowed).toBe(false);
      expect(gbResult.reason).toContain('Lifespan dates are unlisted');
    });
  });

  describe('Edge Cases & Canonical Book Input', () => {
    it('handles null or undefined book gracefully', () => {
      const result = isBookPublicDomainInJurisdiction(null, 'GB');
      expect(result.isAllowed).toBe(false);
      expect(result.reason).toContain('No book entity provided');
    });

    it('blocks book in US if copyright === true', () => {
      const copyrightedBook: GutendexBook = {
        id: 9999,
        title: 'Modern Licensed Volume',
        authors: [{ name: 'Living Author', birth_year: 1980, death_year: null }],
        translators: [],
        subjects: [],
        bookshelves: [],
        languages: ['en'],
        copyright: true,
        media_type: 'Text',
        formats: {},
        download_count: 10,
      };

      expect(isBookPublicDomainInJurisdiction(copyrightedBook, 'US').isAllowed).toBe(false);
    });

    it('evaluates canonical Book interface with string authors and authorDetails', () => {
      const canonicalBook: Book & { authorDetails?: any[] } = {
        id: 1342,
        title: 'Pride and Prejudice',
        authors: ['Jane Austen'],
        authorDetails: [{ name: 'Austen, Jane', birth_year: 1775, death_year: 1817 }],
        subjects: [],
        languages: ['en'],
        coverUrl: null,
        epubUrl: null,
        htmlUrl: null,
        txtUrl: null,
        downloadCount: 1000,
      };

      expect(isBookPublicDomainInJurisdiction(canonicalBook, 'GB', currentYear).isAllowed).toBe(true);
    });

    it('withholds book if authors array is completely empty outside US', () => {
      const emptyAuthorBook = {
        id: 1001,
        title: 'Nameless Pamphlet',
        authors: [],
        translators: [],
        copyright: false,
      };

      expect(isBookPublicDomainInJurisdiction(emptyAuthorBook, 'GB').isAllowed).toBe(false);
    });

    it('formats human-readable descriptions for all jurisdiction rules', () => {
      expect(getJurisdictionRuleDescription('US_PUBLIC_DOMAIN', 'US')).toContain('United States Public Domain');
      expect(getJurisdictionRuleDescription('LIFE_100', 'MX')).toContain('Life + 100 Years');
      expect(getJurisdictionRuleDescription('LIFE_80', 'CO')).toContain('Life + 80 Years');
      expect(getJurisdictionRuleDescription('LIFE_70', 'GB')).toContain('Life + 70 Years');
    });
  });
});
