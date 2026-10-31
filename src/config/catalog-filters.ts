/**
 * Centralized Catalog Filters, Historical Eras, Languages, and Facets for Bookarium
 * Single source of truth across Search, Hero, Catalog Toolbar, and Advanced Filter Drawer.
 * Aligned with Project Gutenberg's official Bookshelf, Subject, Language, and Format taxonomy.
 */

export interface EraOption {
  id: string;
  label: string;
  start?: number;
  end?: number;
}

export interface SortOption {
  value: 'popular' | 'descending' | 'ascending' | '';
  label: string;
}

export interface GenreFacet {
  id: string;
  label: string;
}

export interface LanguageOption {
  value: string;
  label: string;
}

export interface FormatFilter {
  value: string;
  label: string;
}

export const INITIAL_VISIBLE_FACET_COUNT = 13;
export const INITIAL_VISIBLE_LANGUAGE_COUNT = 13;

export const LITERARY_ERAS: EraOption[] = [
  { id: '', label: 'All Historical Eras' },
  { id: 'antiquity', label: 'Antiquity (Pre-500 CE)', start: -800, end: 500 },
  { id: 'middle-ages', label: 'Middle Ages (500–1400 CE)', start: 500, end: 1400 },
  { id: 'renaissance', label: 'Renaissance & Early Modern (1400–1650)', start: 1400, end: 1650 },
  { id: 'enlightenment', label: 'Enlightenment & Reason (1650–1800)', start: 1650, end: 1800 },
  { id: 'victorian', label: '19th Century Victorian & Romantic (1800–1900)', start: 1800, end: 1900 },
  { id: 'early-20th', label: 'Early 20th Century (1900–1928)', start: 1900, end: 1928 },
];

export const SORT_OPTIONS: SortOption[] = [
  { value: 'descending', label: 'Newest Releases (Latest eBook #)' },
  { value: 'popular', label: 'Most Popular (Downloads)' },
  { value: 'ascending', label: 'Oldest Releases (eBook #1 First)' },
];

export const GENRE_FACETS: GenreFacet[] = [
  { id: '', label: 'All Bookshelves & Subjects' },
  // Primary 12 Project Gutenberg Bookshelves (shown by default)
  { id: 'fiction', label: 'Fiction' },
  { id: 'science fiction', label: 'Science Fiction & Fantasy' },
  { id: 'mystery', label: 'Mystery & Detective Fiction' },
  { id: 'gothic', label: 'Gothic & Horror Fiction' },
  { id: 'romance', label: 'Romance & Love Stories' },
  { id: 'historical fiction', label: 'Historical Fiction' },
  { id: 'short stories', label: 'Short Stories' },
  { id: 'adventure', label: 'Adventure & Sea Stories' },
  { id: 'children', label: "Children's Literature" },
  { id: 'poetry', label: 'Poetry' },
  { id: 'drama', label: 'Drama & Plays' },
  { id: 'philosophy', label: 'Philosophy & Ethics' },
  // Extended Project Gutenberg Bookshelf Taxonomy (20 shelves)
  { id: 'history', label: 'History' },
  { id: 'biography', label: 'Biographies & Memoirs' },
  { id: 'religion', label: 'Religion & Spirituality' },
  { id: 'mythology', label: 'Mythology & Folklore' },
  { id: 'science', label: 'Science & Nature' },
  { id: 'humor', label: 'Humor & Satire' },
  { id: 'essays', label: 'Essays, Letters & Speeches' },
  { id: 'politics', label: 'Politics, Society & Law' },
  { id: 'economics', label: 'Economics & Commerce' },
  { id: 'psychology', label: 'Psychology & Mind' },
  { id: 'art', label: 'Art, Architecture & Music' },
  { id: 'travel', label: 'Travel, Geography & Voyages' },
  { id: 'classics', label: 'Classical Antiquity' },
  { id: 'war', label: 'War & Military History' },
  { id: 'western', label: 'Western Stories' },
  { id: 'fairy tales', label: 'Fairy Tales & Fables' },
  { id: 'medicine', label: 'Medicine & Health' },
  { id: 'astronomy', label: 'Astronomy & Space' },
  { id: 'mathematics', label: 'Mathematics & Logic' },
  { id: 'cookery', label: 'Cookery & Domestic Arts' },
];

export const HERO_POPULAR_TOPICS: GenreFacet[] = [
  { id: '', label: 'All Classics' },
  { id: 'fiction', label: 'Fiction' },
  { id: 'science fiction', label: 'Sci-Fi & Fantasy' },
  { id: 'mystery', label: 'Mystery' },
  { id: 'gothic', label: 'Gothic & Horror' },
  { id: 'children', label: "Children's Literature" },
  { id: 'poetry', label: 'Poetry' },
  { id: 'drama', label: 'Drama & Plays' },
  { id: 'philosophy', label: 'Philosophy' },
  { id: 'history', label: 'History' },
  { id: 'biography', label: 'Biographies' },
  { id: 'adventure', label: 'Adventure' },
  { id: 'science', label: 'Science' },
];

export const CATALOG_LANGUAGES: LanguageOption[] = [
  { value: '', label: 'All Languages' },
  // Primary 12 Project Gutenberg Languages (shown by default)
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'French (Français)' },
  { value: 'de', label: 'German (Deutsch)' },
  { value: 'es', label: 'Spanish (Español)' },
  { value: 'it', label: 'Italian (Italiano)' },
  { value: 'la', label: 'Latin (Lingua Latina)' },
  { value: 'el', label: 'Ancient & Modern Greek' },
  { value: 'pt', label: 'Portuguese (Português)' },
  { value: 'nl', label: 'Dutch (Nederlands)' },
  { value: 'ru', label: 'Russian (Русский)' },
  { value: 'zh', label: 'Chinese (中文)' },
  { value: 'ro', label: 'Romanian (Română)' },
  // Extended Top Project Gutenberg Languages (8 languages)
  { value: 'fi', label: 'Finnish (Suomi)' },
  { value: 'sv', label: 'Swedish (Svenska)' },
  { value: 'da', label: 'Danish (Dansk)' },
  { value: 'pl', label: 'Polish (Polski)' },
  { value: 'hu', label: 'Hungarian (Magyar)' },
  { value: 'ca', label: 'Catalan (Català)' },
  { value: 'eo', label: 'Esperanto' },
  { value: 'ja', label: 'Japanese (日本語)' },
];

export const FORMAT_FILTERS: FormatFilter[] = [
  { value: '', label: 'All E-Book Formats' },
  { value: 'application/epub+zip', label: 'EPUB (E-Readers)' },
  { value: 'application/x-mobipocket-ebook', label: 'Kindle (MOBI)' },
  { value: 'text/plain; charset=utf-8', label: 'Plain Text (UTF-8)' },
  { value: 'text/html', label: 'Read Online (HTML)' },
];
