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

import type { Author, GutendexBook, Book } from '@/types/book.types';

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
 * Evaluates an individual contributor (author or translator) under a given term.
 */
function evaluateContributor(
  contributor: Author,
  termYears: number,
  currentYear: number,
  role: 'author' | 'translator'
): AuthorEvaluation {
  const name = contributor.name || 'Anonymous';
  const deathYear = contributor.death_year;
  const birthYear = contributor.birth_year;

  // Case 1: Death year is explicitly known
  if (deathYear !== null && deathYear !== undefined && Number.isFinite(deathYear)) {
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
  if (birthYear !== null && birthYear !== undefined && Number.isFinite(birthYear)) {
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

/**
 * Extracts structured Author objects from varying book representations.
 */
function extractAuthorObjects(book: GenericBookInput): Author[] {
  if (Array.isArray(book.authorDetails) && book.authorDetails.length > 0) {
    return book.authorDetails;
  }
  if (Array.isArray(book.authors)) {
    const result: Author[] = [];
    for (const item of book.authors) {
      if (item && typeof item === 'object' && 'name' in item) {
        result.push(item as Author);
      } else if (typeof item === 'string') {
        result.push({ name: item, birth_year: null, death_year: null });
      }
    }
    return result;
  }
  return [];
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

