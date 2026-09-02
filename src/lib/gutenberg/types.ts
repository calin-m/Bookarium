export interface ChapterSection {
  id: number;
  title: string;
  displayTitle: string;
  content: string;
  startPageNumber: number;
  pageCount: number;
  pages?: string[];
}

export const GUTENBERG_PARSER_CONFIG = {
  CHARS_PER_PAGE_BASE: 5600,
  MIN_CHARS_PER_PAGE: 1200,
  TOC_MAX_HEADING_LENGTH: 180,
  TOC_SEARCH_WINDOW_BYTES: 9000,
  TOC_CLUSTER_BODY_THRESHOLD: 25000,
  ESTIMATED_WORDS_PER_MINUTE: 200,
  HEADER_SCAN_BYTES: 5000,
  PASSAGE_SCAN_BYTES: 120_000,
  TOC_SLICE_BYTES: 4000,
  ANTHOLOGY_MIN_DISTANCE_CHARS: 1000,
  MIN_PARAGRAPH_LENGTH: 35,
  MAX_PARAGRAPH_LENGTH: 800,
  MIN_QUOTE_LENGTH: 15,
  DEFAULT_QUOTE_MAX_LEN: 220,
} as const;

export interface DynamicBookPassage {
  chapterLabel: string;
  openingLine: string;
  secondaryQuote?: string;
  leftPageQuote2?: string;
  quoteExcerpt: string;
  rightPageQuote2?: string;
  tertiaryQuote?: string;
  commentary?: string;
}

