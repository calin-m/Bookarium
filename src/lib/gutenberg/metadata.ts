import { GUTENBERG_PARSER_CONFIG } from './types';

export const LANGUAGE_NAME_TO_CODE_MAP: Record<string, string> = {
  english: 'en',
  dutch: 'nl',
  nederlands: 'nl',
  french: 'fr',
  français: 'fr',
  francais: 'fr',
  german: 'de',
  deutsch: 'de',
  spanish: 'es',
  español: 'es',
  espanol: 'es',
  italian: 'it',
  italiano: 'it',
  portuguese: 'pt',
  português: 'pt',
  portugues: 'pt',
  russian: 'ru',
  latin: 'la',
  greek: 'el',
  esperanto: 'eo',
  swedish: 'sv',
  danish: 'da',
  norwegian: 'no',
  finnish: 'fi',
  polish: 'pl',
  hungarian: 'hu',
  chinese: 'zh',
  japanese: 'ja',
};

export function normalizeLanguageToCode(rawLang?: string | null): string | undefined {
  if (!rawLang) return undefined;
  const clean = rawLang.trim().toLowerCase();
  if (/^[a-z]{2,3}$/.test(clean)) {
    return clean;
  }
  return LANGUAGE_NAME_TO_CODE_MAP[clean] || (clean.length >= 2 ? clean.slice(0, 2) : undefined);
}

/**
 * Extract Title, Author, and Language directly from the Project Gutenberg preamble header.
 */
export function extractGutenbergHeaderMetadata(rawText: string | undefined | null): {
  title?: string;
  author?: string;
  language?: string;
} {
  if (!rawText) return {};
  const headerSlice = rawText.slice(0, GUTENBERG_PARSER_CONFIG.HEADER_SCAN_BYTES);
  const titleMatch = /^\s*(?:Title|Titel|Titre|Título|Titulo):\s*([^\r\n]+)/im.exec(headerSlice);
  const authorMatch =
    /^\s*(?:Author|Auteur|Autor|Autore):\s*([^\r\n]+)/im.exec(headerSlice) ||
    /^\s*by\s+([^\r\n]+)/im.exec(headerSlice);
  const languageMatch = /^\s*(?:Language|Taal|Langue|Idioma|Lingua|Sprache):\s*([^\r\n]+)/im.exec(headerSlice);

  const rawLang = languageMatch ? languageMatch[1].replace(/\s+/g, ' ').trim() : undefined;
  const normalizedLang = normalizeLanguageToCode(rawLang);

  return {
    title: titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : undefined,
    author: authorMatch ? authorMatch[1].replace(/\s+/g, ' ').trim() : undefined,
    language: normalizedLang,
  };
}

