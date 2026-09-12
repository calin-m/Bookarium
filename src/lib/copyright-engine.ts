/**
 * Bookarium Copyright Calculation Engine
 *
 * Implements jurisdictional public domain compliance based on:
 * 1. United States: Works published <= 1930 (or cleared by Project Gutenberg US with copyright: false).
 * 2. Life + 70 Jurisdictions: Berne Convention & EU Directive 2006/116/EC (UK, EU 27, Canada, Australia, etc.).
 * 3. Life + 100 Jurisdictions: Mexico (Ley Federal del Derecho de Autor Art. 29), Cote d'Ivoire.
 * 4. Life + 80 Jurisdictions: Colombia (Ley 23 de 1982), Spain (Transitional Art. 4 for pre-1987 deaths).
 * 5. Joint Authorship: Berne Convention Art. 7bis (term calculated from the death of the last surviving author).
 * 6. Translations: Berne Convention Art. 2(3) (independent copyright for translators).
 * 7. Longevity Heuristic: Conservative maximum human lifespan (100 years) for unlisted author death years.
 */

import type { Author, GutendexBook } from '@/types/book.types';

export type JurisdictionRule = 'US_PUBLIC_DOMAIN' | 'LIFE_70' | 'LIFE_80' | 'LIFE_100';

export interface CopyrightEvaluationResult {
  isAllowed: boolean;
  country: string;
  rule: JurisdictionRule;
  publicDomainYear?: number;
  restrictingAuthor?: string;
  restrictingDeathYear?: number;
  reason?: string;
}

// 27 EU Member States
export const EU_MEMBER_STATES = new Set([
  'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI',
  'FR', 'GR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT',
  'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK',
]);

// Other prominent Life + 70 non-EU countries
export const LIFE_70_COUNTRIES = new Set([
  ...EU_MEMBER_STATES,
  'GB', 'CA', 'AU', 'NZ', 'NO', 'CH', 'IS', 'LI', 'JP', 'BR',
  'RU', 'IL', 'SG', 'TR', 'UA', 'RS', 'BA', 'ME', 'MK', 'AL',
  'GE', 'AM', 'AR', 'CL', 'PE', 'EC', 'PY',
]);

// Life + 100 countries
export const LIFE_100_COUNTRIES = new Set([
  'MX', // Mexico
  'CI', // Cote d'Ivoire
]);

// Life + 80 countries
export const LIFE_80_COUNTRIES = new Set([
  'CO', // Colombia
  // Note: Spain ('ES') uses Life+80 for authors deceased before Dec 7, 1987
]);

// United States and territories
export const US_JURISDICTIONS = new Set([
  'US', 'PR', 'VI', 'GU', 'AS', 'MP',
]);

/**
 * Normalizes an ISO country code string (2-letter uppercase).
 */
export function normalizeCountryCode(countryCode?: string | null): string {
  if (!countryCode || typeof countryCode !== 'string') {
    return 'US';
  }
  const clean = countryCode.trim().toUpperCase().slice(0, 2);
  return clean || 'US';
}

/**
 * Resolves the applicable copyright rule for a given country code.
 */
export function getJurisdictionRule(countryCode: string): JurisdictionRule {
  const code = normalizeCountryCode(countryCode);

  if (US_JURISDICTIONS.has(code)) {
    return 'US_PUBLIC_DOMAIN';
  }
  if (LIFE_100_COUNTRIES.has(code)) {
    return 'LIFE_100';
  }
  if (LIFE_80_COUNTRIES.has(code) || code === 'ES') {
    return 'LIFE_80';
  }
  if (LIFE_70_COUNTRIES.has(code)) {
    return 'LIFE_70';
  }

  // Conservative default for all other or unmapped international countries: Life + 70
  return 'LIFE_70';
}

/**
 * Human maximum longevity constant used to bound unlisted death years.
 */
const MAX_HUMAN_LIFESPAN = 100;

interface AuthorEvaluation {
  isCleared: boolean;
  restrictingAuthor?: string;
  deathYear?: number;
  expectedPublicDomainYear?: number;
  reason?: string;
}

/**
 * Extracts birth and death years from author name strings when structured fields are missing
 * e.g. "Austen, Jane, 1775-1817", "Wells, H. G., 1866-1946", "Author [1850-1920]", "Author, d. 1925"
 */
export function parseLifespansFromName(rawName?: string | null): { birthYear: number | null; deathYear: number | null } {
  if (!rawName || typeof rawName !== 'string') {
    return { birthYear: null, deathYear: null };
  }

  // Pattern 1: Standard YYYY-YYYY or YYYY–YYYY e.g. "1775-1817", "1890-1976", "[1835-1910]"
  const rangeMatch = rawName.match(/(?:^|[(\[\,\s])(\d{3,4})\s*[-–—]\s*(\d{3,4})(?:$|[)\]\,\s])/);
  if (rangeMatch) {
    const b = parseInt(rangeMatch[1], 10);
    const d = parseInt(rangeMatch[2], 10);
    if (Number.isFinite(b) && Number.isFinite(d) && d >= b) {
      return { birthYear: b, deathYear: d };
    }
  }

  // Pattern 2: Died / d. YYYY e.g. "d. 1817", "died 1925"
  const diedMatch = rawName.match(/(?:d\.|died|death)\s*(\d{3,4})/i);
  if (diedMatch) {
    const d = parseInt(diedMatch[1], 10);
    if (Number.isFinite(d)) {
      return { birthYear: null, deathYear: d };
    }
  }

  // Pattern 3: Born / b. YYYY e.g. "b. 1775", "born 1850"
  const bornMatch = rawName.match(/(?:b\.|born|birth)\s*(\d{3,4})/i);
  if (bornMatch) {
    const b = parseInt(bornMatch[1], 10);
    if (Number.isFinite(b)) {
      return { birthYear: b, deathYear: null };
    }
  }

  return { birthYear: null, deathYear: null };
}

/**
 * Evaluates an individual contributor (author or translator) under a given term.
 */
function evaluateContributor(
  contributor: Author,
  termYears: number,
  currentYear: number,
  role: 'author' | 'translator'
): AuthorEvaluation {
  const name = contributor.name || 'Anonymous';
  const rawDeath = (contributor as { death_year?: unknown }).death_year;
  const rawBirth = (contributor as { birth_year?: unknown }).birth_year;

  let deathYear: number | null = null;
  if (typeof rawDeath === 'number' && Number.isFinite(rawDeath)) {
    deathYear = rawDeath;
  } else if (typeof rawDeath === 'string' && rawDeath.trim() !== '') {
    const parsed = Number(rawDeath.trim());
    if (Number.isFinite(parsed)) deathYear = parsed;
  }

  let birthYear: number | null = null;
  if (typeof rawBirth === 'number' && Number.isFinite(rawBirth)) {
    birthYear = rawBirth;
  } else if (typeof rawBirth === 'string' && rawBirth.trim() !== '') {
    const parsed = Number(rawBirth.trim());
    if (Number.isFinite(parsed)) birthYear = parsed;
  }

  // Fallback: If lifespans are missing from structured fields, parse from name string
  if (deathYear === null && birthYear === null && contributor.name) {
    const parsed = parseLifespansFromName(contributor.name);
    if (parsed.deathYear !== null) deathYear = parsed.deathYear;
    if (parsed.birthYear !== null) birthYear = parsed.birthYear;
  }

  // Case 1: Death year is explicitly known
  if (deathYear !== null && Number.isFinite(deathYear)) {
    const publicDomainYear = deathYear + termYears + 1;
    const isCleared = currentYear >= publicDomainYear;

    if (!isCleared) {
      return {
        isCleared: false,
        restrictingAuthor: `${name} (${role})`,
        deathYear,
        expectedPublicDomainYear: publicDomainYear,
        reason: `Deceased in ${deathYear}. Protected under Life + ${termYears} until January 1, ${publicDomainYear}.`,
      };
    }
    return { isCleared: true, deathYear, expectedPublicDomainYear: publicDomainYear };
  }

  // Case 2: Death year is missing, but birth year is known
  if (birthYear !== null && Number.isFinite(birthYear)) {
    // If born within: currentYear - termYears - MAX_HUMAN_LIFESPAN - 1
    // they could have lived MAX_HUMAN_LIFESPAN years and died within the protected period.
    const safeBirthCutoff = currentYear - termYears - MAX_HUMAN_LIFESPAN - 1;
    if (birthYear <= safeBirthCutoff) {
      return { isCleared: true };
    }

    // Author may have lived into the protected period
    const estimatedLatestDeath = birthYear + MAX_HUMAN_LIFESPAN;
    const estimatedPDYear = estimatedLatestDeath + termYears + 1;
    return {
      isCleared: false,
      restrictingAuthor: `${name} (${role})`,
      reason: `Birth year ${birthYear} does not guarantee contributor died >= ${termYears} years ago. Withheld under fail-closed longevity policy.`,
      expectedPublicDomainYear: estimatedPDYear,
    };
  }

  // Case 3: Both death year and birth year are unknown
  return {
    isCleared: false,
    restrictingAuthor: `${name} (${role})`,
    reason: `Lifespan dates are unlisted for ${role} ${name}. Withheld under international fail-closed protocol.`,
  };
}

export interface GenericBookInput {
  id?: number;
  title?: string;
  authors?: (Author | string)[];
  authorDetails?: Author[];
  translators?: Author[];
  copyright?: boolean | null;
}

const NON_AUTHOR_CONTRIBUTOR_PATTERN = /(?:\[|\()(?:illustrator|photographer|engraver|artist|decorator|calligrapher|ill\.|photo\.)(?:\]|\))/i;

export function isNonAuthorContributor(name?: string | null): boolean {
  if (!name || typeof name !== 'string') return false;
  return NON_AUTHOR_CONTRIBUTOR_PATTERN.test(name);
}

/**
 * Extracts structured Author objects from varying book representations.
 * Excludes secondary non-literary contributors (e.g. [Illustrator], [Photographer])
 * to prevent auxiliary artists from falsely blocking literary text works.
 */
function extractAuthorObjects(book: GenericBookInput): Author[] {
  let list: Author[] = [];
  if (Array.isArray(book.authorDetails) && book.authorDetails.length > 0) {
    list = book.authorDetails.map((a) => {
      if ((a.death_year === null || a.death_year === undefined) && (a.birth_year === null || a.birth_year === undefined) && a.name) {
        const parsed = parseLifespansFromName(a.name);
        return {
          name: a.name,
          birth_year: parsed.birthYear,
          death_year: parsed.deathYear,
        };
      }
      return a;
    });
  } else if (Array.isArray(book.authors)) {
    for (const item of book.authors) {
      if (item && typeof item === 'object' && 'name' in item) {
        const a = item as Author;
        if ((a.death_year === null || a.death_year === undefined) && (a.birth_year === null || a.birth_year === undefined) && a.name) {
          const parsed = parseLifespansFromName(a.name);
          list.push({
            name: a.name,
            birth_year: parsed.birthYear,
            death_year: parsed.deathYear,
          });
        } else {
          list.push(a);
        }
      } else if (typeof item === 'string') {
        const parsed = parseLifespansFromName(item);
        list.push({ name: item, birth_year: parsed.birthYear, death_year: parsed.deathYear });
      }
    }
  }

  if (list.length > 1) {
    const withoutNonAuthors = list.filter((a) => !isNonAuthorContributor(a.name));
    if (withoutNonAuthors.length > 0) {
      return withoutNonAuthors;
    }
  }

  return list;
}

/**
 * Core Jurisdictional Public Domain Evaluator
 *
 * Enforces Berne Convention and regional rules. Pure function with zero external side-effects.
 */
export function isBookPublicDomainInJurisdiction(
  book: GenericBookInput | null | undefined,
  countryCode?: string | null,
  currentYear?: number
): CopyrightEvaluationResult {
  const year = currentYear ?? new Date().getFullYear();
  const country = normalizeCountryCode(countryCode);
  const rule = getJurisdictionRule(country);

  if (!book) {
    return {
      isAllowed: false,
      country,
      rule,
      reason: 'No book entity provided for copyright evaluation.',
    };
  }

  // Rule 1: United States
  // In the US, works published <= 1930 are public domain. Gutendex signals this with copyright === false.
  if (rule === 'US_PUBLIC_DOMAIN') {
    // If explicitly marked as copyrighted, withhold
    if (book.copyright === true) {
      return {
        isAllowed: false,
        country,
        rule,
        reason: 'Marked with active copyright notice in Project Gutenberg catalog.',
      };
    }
    return {
      isAllowed: true,
      country,
      rule,
    };
  }

  // International Jurisdictions: Determine term in years
  let termYears = 70;
  if (rule === 'LIFE_100') {
    termYears = 100;
  } else if (rule === 'LIFE_80') {
    termYears = 80;
  }

  const authors = extractAuthorObjects(book);
  const translators = Array.isArray(book.translators) ? book.translators : [];

  // If no contributors are listed at all, check if book has explicit US public domain clearance
  if (authors.length === 0 && translators.length === 0) {
    return {
      isAllowed: false,
      country,
      rule,
      reason: 'Anonymous or uncredited volume with unverified international copyright status.',
    };
  }

  // Berne Convention Art. 7bis & Art. 2(3):
  // EVERY author AND EVERY translator must be public domain. If even one died within the term, withhold.
  for (const author of authors) {
    const evaluation = evaluateContributor(author, termYears, year, 'author');
    if (!evaluation.isCleared) {
      return {
        isAllowed: false,
        country,
        rule,
        restrictingAuthor: evaluation.restrictingAuthor,
        restrictingDeathYear: evaluation.deathYear,
        publicDomainYear: evaluation.expectedPublicDomainYear,
        reason: evaluation.reason,
      };
    }
  }

  for (const translator of translators) {
    const evaluation = evaluateContributor(translator, termYears, year, 'translator');
    if (!evaluation.isCleared) {
      return {
        isAllowed: false,
        country,
        rule,
        restrictingAuthor: evaluation.restrictingAuthor,
        restrictingDeathYear: evaluation.deathYear,
        publicDomainYear: evaluation.expectedPublicDomainYear,
        reason: evaluation.reason,
      };
    }
  }

  return {
    isAllowed: true,
    country,
    rule,
  };
}

/**
 * Human-readable description of a jurisdiction rule for UI presentation.
 */
export function getJurisdictionRuleDescription(rule: JurisdictionRule, country: string): string {
  switch (rule) {
    case 'US_PUBLIC_DOMAIN':
      return `United States Public Domain (17 U.S.C. § 304 — published on or before 1930)`;
    case 'LIFE_100':
      return `Life + 100 Years (${country} Federal Copyright Law — author deceased >= 100 years)`;
    case 'LIFE_80':
      return `Life + 80 Years (${country} Intellectual Property Statute — author deceased >= 80 years)`;
    case 'LIFE_70':
    default:
      return `Life + 70 Years (Berne Convention / ${country} Copyright Law — author deceased >= 70 years)`;
  }
}

/**
 * Canonical public domain baseline totals for unfiltered catalog browsing by jurisdiction.
 * Prevents catalog counters from fluctuating between 55k and 78k during transient provider failovers.
 */
export const JURISDICTION_BASELINE_COUNTS: Record<JurisdictionRule, number> = {
  US_PUBLIC_DOMAIN: 78086,
  LIFE_70: 55754,
  LIFE_80: 50200,
  LIFE_100: 42100,
};

/**
 * Resolves an ISO 3166-1 alpha-2 country code into an authentic English country name.
 * Safe fallback to uppercase country code if Intl.DisplayNames is unavailable or code is unmapped.
 */
export function getCountryDisplayName(countryCode: string): string {
  const code = normalizeCountryCode(countryCode);
  try {
    if (typeof Intl !== 'undefined' && typeof Intl.DisplayNames === 'function') {
      const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
      return regionNames.of(code) || code;
    }
  } catch {
    // Graceful fallback
  }
  return code;
}

/**
 * Generates a concise human-readable jurisdiction badge label for catalog section headers.
 * e.g. "Romania • Life + 70", "United States", "Mexico • Life + 100"
 */
export function getJurisdictionShortLabel(rule: JurisdictionRule, countryCode: string): string {
  const countryName = getCountryDisplayName(countryCode);
  switch (rule) {
    case 'US_PUBLIC_DOMAIN':
      return 'United States';
    case 'LIFE_100':
      return `${countryName} • Life + 100`;
    case 'LIFE_80':
      return `${countryName} • Life + 80`;
    case 'LIFE_70':
    default:
      return `${countryName} • Life + 70`;
  }
}

export interface PartitionedBooks<T extends GenericBookInput = GutendexBook> {
  downloadableBooks: T[];
  restrictedBooks: T[];
}

/**
 * Partitions a collection of books into downloadable/public domain titles
 * and copyright-restricted titles based on the user's jurisdiction.
 */
export function partitionBooksByJurisdiction<T extends GenericBookInput = GutendexBook>(
  books: T[],
  countryCode?: string | null,
  currentYear?: number
): PartitionedBooks<T> {
  const downloadable: T[] = [];
  const restricted: T[] = [];

  for (const book of books) {
    if (isBookPublicDomainInJurisdiction(book, countryCode, currentYear).isAllowed) {
      downloadable.push(book);
    } else {
      restricted.push(book);
    }
  }

  return {
    downloadableBooks: downloadable,
    restrictedBooks: restricted,
  };
}



