/**
 * Content Advisory & Historical Maturity Classification Service for Bookarium
 * Evaluates Library of Congress Subject Headings (LCSH) and Project Gutenberg
 * bookshelves to identify mature, erotic, or sensitive historical literature
 * under EU DSA Art. 28, UK Online Safety Act, and German JMStV frameworks.
 */

export interface ContentAdvisoryResult {
  isMature: boolean;
  matchedSubject?: string;
  advisoryTitle: string;
  advisoryMessage: string;
}

export const MATURE_CONTENT_KEYWORDS = [
  'erotic',
  'erotica',
  'sex',
  'sexual',
  'prostitution',
  'obscenity',
  'sadism',
  'masochism',
  'libertine',
  'flagellation',
] as const;

/**
 * Scans a book's subject headings and bookshelves for mature or adult themes.
 * Returns a non-blocking advisory descriptor explaining the historical context.
 */
export function evaluateContentAdvisory(
  subjects: string[] = [],
  bookshelves: string[] = []
): ContentAdvisoryResult {
  const combined = [...subjects, ...bookshelves];

  for (const item of combined) {
    if (!item || typeof item !== 'string') continue;
    const normalized = item.toLowerCase();

    for (const keyword of MATURE_CONTENT_KEYWORDS) {
      // Word boundary or partial match for sensitive topics
      const regex = new RegExp(`\\b${keyword}`, 'i');
      if (regex.test(normalized)) {
        return {
          isMature: true,
          matchedSubject: item,
          advisoryTitle: 'Historical Content Advisory',
          advisoryMessage: `This historical volume contains unexpurgated mature themes (${item}) unedited from the archival record. Presented for cultural preservation and educational research.`,
        };
      }
    }
  }

  return {
    isMature: false,
    advisoryTitle: '',
    advisoryMessage: '',
  };
}

