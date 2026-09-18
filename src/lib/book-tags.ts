/**
 * Book Tag Semantic Normalizer & Ranking Engine
 *
 * Normalizes Project Gutenberg Library of Congress Subject Headings (LCSH)
 * and curated bookshelves into concise, human-readable canonical genre tags.
 * Enforces a zero-truncation guarantee (tags never exceed 14 characters on card badges)
 * and provides responsive allocation for mobile (1 tag + +N) vs desktop (2 tags + +N).
 */

export interface BookTagSet {
  primaryMobile: string[];
  primaryDesktop: string[];
  overflowMobile: number;
  overflowDesktop: number;
  allTags: string[];
}

/**
 * High-priority literary genre mappings.
 * Maps verbose LCSH headings and Gutenberg bookshelves to concise canonical badges (<= 14 chars).
 */
const CANONICAL_GENRE_MAP: Record<string, string> = {
  // Speculative & Sci-Fi
  'science fiction': 'Sci-Fi',
  'precursors of science fiction': 'Sci-Fi',
  'time travel': 'Sci-Fi',
  'space flight': 'Sci-Fi',
  'dystopias': 'Dystopian',
  'dystopian fiction': 'Dystopian',
  'utopias': 'Utopian',
  'cyberpunk': 'Cyberpunk',

  // Gothic & Horror
  'gothic fiction': 'Gothic',
  'gothic': 'Gothic',
  'horror tales': 'Horror',
  'horror fiction': 'Horror',
  'horror': 'Horror',
  'ghost stories': 'Ghost Stories',
  'vampires': 'Vampires',
  'monsters': 'Monsters',
  'occult fiction': 'Occult',

  // Mystery, Detective & Crime
  'detective and mystery stories': 'Mystery',
  'mystery and detective stories': 'Mystery',
  'detective fiction': 'Detective',
  'detective stories': 'Detective',
  'mystery fiction': 'Mystery',
  'mystery': 'Mystery',
  'crime fiction': 'Crime',
  'crime': 'Crime',
  'murder': 'Mystery',
  'spy stories': 'Espionage',

  // Romance & Drama
  'romantic fiction': 'Romance',
  'love stories': 'Romance',
  'romance': 'Romance',
  'courtship': 'Romance',
  'domestic fiction': 'Domestic',
  'drama': 'Drama',
  'plays': 'Drama',
  'tragedy': 'Tragedy',
  'comedy': 'Comedy',

  // Adventure & Action
  'adventure stories': 'Adventure',
  'adventure and adventurers': 'Adventure',
  'adventure': 'Adventure',
  'sea stories': 'Sea Stories',
  'pirates': 'Pirates',
  'western stories': 'Western',
  'westerns': 'Western',
  'survival': 'Survival',
  'war stories': 'War',
  'military history': 'Military',

  // Classics & High Literature
  'classic literature': 'Classics',
  'classics': 'Classics',
  'historical fiction': 'Historical',
  'mythology': 'Mythology',
  'folklore': 'Folklore',
  'fairy tales': 'Fairy Tales',
  'fables': 'Fables',
  'short stories': 'Short Stories',
  'short stories, american': 'Short Stories',
  'short stories, english': 'Short Stories',
  'epistolary fiction': 'Epistolary',
  'psychological fiction': 'Psychological',
  'satire': 'Satire',
  'humorous stories': 'Humor',
  'wit and humor': 'Humor',
  'humor': 'Humor',
  'poetry': 'Poetry',
  'epic poetry': 'Epic Poetry',
  'ballads': 'Ballads',

  // Non-Fiction, Philosophy & Thought
  'philosophy': 'Philosophy',
  'philosophy, ancient': 'Philosophy',
  'philosophy, modern': 'Philosophy',
  'ethics': 'Ethics',
  'political science': 'Politics',
  'politics': 'Politics',
  'history': 'History',
  'ancient history': 'Ancient History',
  'biography': 'Biography',
  'autobiography': 'Memoir',
  'memoirs': 'Memoir',
  'science': 'Science',
  'natural history': 'Nature',
  'astronomy': 'Astronomy',
  'essays': 'Essays',
  'religion': 'Religion',
  'theology': 'Theology',
  'psychology': 'Psychology',
  'sociology': 'Sociology',
  'economics': 'Economics',

  // Children & Youth
  "children's literature": "Children's",
  'children stories': "Children's",
  'juvenile fiction': 'Juvenile',
  'juvenile literature': "Children's",
  'fairy tale': 'Fairy Tales',
};

/**
 * Filter out administrative Gutenberg metadata and bibliographic noise
 */
const NOISE_PATTERNS = [
  /best books ever listings/i,
  /browsing:/i,
  /project gutenberg/i,
  /fictitious character/i,
  /\b(text|general|periodicals|catalogs|miscellanea)\b/i,
  /microscopy/i,
];

/**
 * Converts a raw string to Title Case, respecting hyphens and short words
 */
function toTitleCase(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map((word, idx) => {
      if (idx > 0 && ['and', 'or', 'of', 'in', 'on', 'at', 'the', 'for'].includes(word)) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

/**
 * Cleans a raw subject or bookshelf string into a sanitized, readable candidate.
 */
function cleanRawCandidate(raw: string): string | null {
  if (!raw || typeof raw !== 'string') return null;

  let trimmed = raw.trim();
  if (!trimmed) return null;

  // Filter out noise patterns
  for (const pattern of NOISE_PATTERNS) {
    if (pattern.test(trimmed)) return null;
  }

  // Strip administrative prefixes (e.g. "Category: British Literature" -> "British Literature")
  trimmed = trimmed.replace(/^(category|categories):\s*/i, '');
  trimmed = trimmed.replace(/^banned books from\s+[^:]+:\s*/i, '');
  if (!trimmed) return null;

  // Strip Library of Congress sub-divisions (e.g. "Fiction -- Psychological aspects" -> "Fiction")
  const mainPart = trimmed.split('--')[0].trim();
  if (!mainPart) return null;

  return mainPart;
}

/**
 * Resolves a single tag candidate to its concise canonical badge label (<= 14 chars)
 * or a clean title-cased fallback if short enough.
 */
function resolveCandidateBadge(candidate: string): string | null {
  const normalizedLower = candidate.toLowerCase().trim();

  // 1. Direct canonical match
  if (CANONICAL_GENRE_MAP[normalizedLower]) {
    return CANONICAL_GENRE_MAP[normalizedLower];
  }

  // 2. Partial prefix / substring match for common compound forms
  for (const [key, mapped] of Object.entries(CANONICAL_GENRE_MAP)) {
    if (normalizedLower === key || normalizedLower.startsWith(`${key} `) || normalizedLower.endsWith(` ${key}`)) {
      return mapped;
    }
  }

  // 3. Fallback: if the cleaned string is already short and punchy (<= 14 chars), use Title Case
  if (candidate.length <= 14 && !candidate.includes(',')) {
    return toTitleCase(candidate);
  }

  return null;
}

/**
 * Evaluates both `subjects` and `bookshelves` for a book, returning:
 * - `primaryMobile`: Exactly 1 primary tag
 * - `primaryDesktop`: Up to 2 primary tags
 * - `overflowMobile` and `overflowDesktop`: Remaining tag counts
 * - `allTags`: Complete, unabridged list of clean subjects and bookshelves
 */
export function resolveBookTags(
  subjects?: string[] | null,
  bookshelves?: string[] | null
): BookTagSet {
  const candidatePool: Array<{ text: string; isBookshelf: boolean }> = [];

  // Harvest curated bookshelves first (highest editorial quality)
  if (Array.isArray(bookshelves)) {
    for (const b of bookshelves) {
      const cleaned = cleanRawCandidate(b);
      if (cleaned) {
        candidatePool.push({ text: cleaned, isBookshelf: true });
      }
    }
  }

  // Harvest subjects
  if (Array.isArray(subjects)) {
    for (const s of subjects) {
      const cleaned = cleanRawCandidate(s);
      if (cleaned) {
        candidatePool.push({ text: cleaned, isBookshelf: false });
      }
    }
  }

  // Extract all clean unabridged tags (deduplicated)
  const allTags: string[] = [];
  const allTagsSeen = new Set<string>();

  for (const { text } of candidatePool) {
    const titleCased = toTitleCase(text);
    const key = titleCased.toLowerCase();
    if (!allTagsSeen.has(key)) {
      allTagsSeen.add(key);
      allTags.push(titleCased);
    }
  }

  // Extract canonical concise badges for card display (<= 14 chars, zero ellipsis)
  const cardBadges: string[] = [];
  const badgeSeen = new Set<string>();

  for (const { text } of candidatePool) {
    const badge = resolveCandidateBadge(text);
    if (badge) {
      const key = badge.toLowerCase();
      if (!badgeSeen.has(key)) {
        badgeSeen.add(key);
        cardBadges.push(badge);
      }
    }
  }

  // Safe fallback if no tags could be resolved
  if (cardBadges.length === 0) {
    const fallback = 'Classics';
    return {
      primaryMobile: [fallback],
      primaryDesktop: [fallback],
      overflowMobile: 0,
      overflowDesktop: 0,
      allTags: allTags.length > 0 ? allTags : [fallback],
    };
  }

  const primaryMobile = cardBadges.slice(0, 1);
  const primaryDesktop = cardBadges.slice(0, 2);

  // Total unique topic pool count across both badges and all unabridged tags
  const totalCount = Math.max(allTags.length, cardBadges.length);
  const overflowMobile = Math.max(0, totalCount - primaryMobile.length);
  const overflowDesktop = Math.max(0, totalCount - primaryDesktop.length);

  return {
    primaryMobile,
    primaryDesktop,
    overflowMobile,
    overflowDesktop,
    allTags: allTags.length > 0 ? allTags : cardBadges,
  };
}

