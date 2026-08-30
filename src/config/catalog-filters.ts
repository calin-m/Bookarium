/**
 * Centralized Catalog Filters, Historical Eras, Languages, and Facets for Bookarium
 * Single source of truth across Search, Hero, Catalog Toolbar, and Advanced Filter Drawer.
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
  { value: 'popular', label: 'Most Popular (Download Count)' },
  { value: 'descending', label: 'Recently Added to Gutenberg' },
  { value: 'ascending', label: 'Oldest Catalog ID' },
];

export const GENRE_FACETS: GenreFacet[] = [
  { id: '', label: 'All Subjects' },
  { id: 'philosophy', label: 'Classical Philosophy & Ethics' },
  { id: 'fiction', label: 'Classic Literature & Fiction' },
  { id: 'gothic', label: 'Gothic, Mystery & Horror' },
  { id: 'poetry', label: 'Poetry, Epics & Sonnets' },
  { id: 'science', label: 'Science, Mathematics & Nature' },
  { id: 'drama', label: 'Drama, Theatre & Plays' },
  { id: 'history', label: 'History, Treatises & Biographies' },
  { id: 'adventure', label: 'Sea Stories, Voyages & Adventure' },
  { id: 'mythology', label: 'Mythology & Folklore' },
];

export const HERO_POPULAR_TOPICS: GenreFacet[] = [
  { id: '', label: 'All Classics' },
  { id: 'philosophy', label: 'Philosophy' },
  { id: 'fiction', label: 'Fiction' },
  { id: 'gothic', label: 'Gothic Horror' },
  { id: 'poetry', label: 'Poetry' },
  { id: 'science', label: 'Science' },
  { id: 'drama', label: 'Drama' },
  { id: 'adventure', label: 'Sea & Adventure' },
];

export const EXTENDED_LANGUAGES: LanguageOption[] = [
  { value: '', label: 'All Languages' },
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
];

export const HERO_LANGUAGES: LanguageOption[] = [
  { value: '', label: 'All Languages' },
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'es', label: 'Spanish' },
  { value: 'it', label: 'Italian' },
  { value: 'la', label: 'Latin' },
  { value: 'el', label: 'Greek' },
];

export const FORMAT_FILTERS: FormatFilter[] = [
  { value: '', label: 'All Digital Formats' },
  { value: 'application/epub+zip', label: 'EPUB E-Reader Available' },
  { value: 'application/x-mobipocket-ebook', label: 'Kindle (MOBI) Available' },
  { value: 'text/plain; charset=utf-8', label: 'Plain Text (UTF-8)' },
  { value: 'text/html', label: 'HTML Web Reader' },
];

