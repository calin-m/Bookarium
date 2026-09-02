/**
 * Centralized catalog of supported translation languages for dynamic book translation
 */

export interface TranslationLanguage {
  code: string;
  label: string;
  nativeLabel: string;
  flag: string;
}

export const POPULAR_TRANSLATION_LANGUAGES: TranslationLanguage[] = [
  { code: 'es', label: 'Spanish', nativeLabel: 'Español', flag: '🇪🇸' },
  { code: 'fr', label: 'French', nativeLabel: 'Français', flag: '🇫🇷' },
  { code: 'de', label: 'German', nativeLabel: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', label: 'Italian', nativeLabel: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', label: 'Portuguese', nativeLabel: 'Português', flag: '🇵🇹' },
  { code: 'ro', label: 'Romanian', nativeLabel: 'Română', flag: '🇷🇴' },
  { code: 'nl', label: 'Dutch', nativeLabel: 'Nederlands', flag: '🇳🇱' },
  { code: 'pl', label: 'Polish', nativeLabel: 'Polski', flag: '🇵🇱' },
  { code: 'uk', label: 'Ukrainian', nativeLabel: 'Українська', flag: '🇺🇦' },
  { code: 'ja', label: 'Japanese', nativeLabel: '日本語', flag: '🇯🇵' },
  { code: 'zh-CN', label: 'Chinese (Simplified)', nativeLabel: '简体中文', flag: '🇨🇳' },
  { code: 'ko', label: 'Korean', nativeLabel: '한국어', flag: '🇰🇷' },
  { code: 'el', label: 'Greek', nativeLabel: 'Ελληνικά', flag: '🇬🇷' },
  { code: 'tr', label: 'Turkish', nativeLabel: 'Türkçe', flag: '🇹🇷' },
  { code: 'ar', label: 'Arabic', nativeLabel: 'العربية', flag: '🇸🇦' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी', flag: '🇮🇳' },
  { code: 'sv', label: 'Swedish', nativeLabel: 'Svenska', flag: '🇸🇪' },
  { code: 'ru', label: 'Russian', nativeLabel: 'Русский', flag: '🇷🇺' },
];

export const ALL_TRANSLATION_LANGUAGES: TranslationLanguage[] = [
  ...POPULAR_TRANSLATION_LANGUAGES,
  { code: 'bg', label: 'Bulgarian', nativeLabel: 'Български', flag: '🇧🇬' },
  { code: 'ca', label: 'Catalan', nativeLabel: 'Català', flag: '🇪🇸' },
  { code: 'cs', label: 'Czech', nativeLabel: 'Čeština', flag: '🇨🇿' },
  { code: 'da', label: 'Danish', nativeLabel: 'Dansk', flag: '🇩🇰' },
  { code: 'en', label: 'English', nativeLabel: 'English', flag: '🇬🇧' },
  { code: 'et', label: 'Estonian', nativeLabel: 'Eesti', flag: '🇪🇪' },
  { code: 'fi', label: 'Finnish', nativeLabel: 'Suomi', flag: '🇫🇮' },
  { code: 'he', label: 'Hebrew', nativeLabel: 'עברית', flag: '🇮🇱' },
  { code: 'hr', label: 'Croatian', nativeLabel: 'Hrvatski', flag: '🇭🇷' },
  { code: 'hu', label: 'Hungarian', nativeLabel: 'Magyar', flag: '🇭🇺' },
  { code: 'id', label: 'Indonesian', nativeLabel: 'Bahasa Indonesia', flag: '🇮🇩' },
  { code: 'is', label: 'Icelandic', nativeLabel: 'Íslenska', flag: '🇮🇸' },
  { code: 'la', label: 'Latin', nativeLabel: 'Lingua Latina', flag: '🏛️' },
  { code: 'lt', label: 'Lithuanian', nativeLabel: 'Lietuvių', flag: '🇱🇹' },
  { code: 'lv', label: 'Latvian', nativeLabel: 'Latviešu', flag: '🇱🇻' },
  { code: 'ms', label: 'Malay', nativeLabel: 'Bahasa Melayu', flag: '🇲🇾' },
  { code: 'no', label: 'Norwegian', nativeLabel: 'Norsk', flag: '🇳🇴' },
  { code: 'sk', label: 'Slovak', nativeLabel: 'Slovenčina', flag: '🇸🇰' },
  { code: 'sl', label: 'Slovenian', nativeLabel: 'Slovenščina', flag: '🇸🇮' },
  { code: 'sr', label: 'Serbian', nativeLabel: 'Српски', flag: '🇷🇸' },
  { code: 'th', label: 'Thai', nativeLabel: 'ไทย', flag: '🇹🇭' },
  { code: 'vi', label: 'Vietnamese', nativeLabel: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'zh-TW', label: 'Chinese (Traditional)', nativeLabel: '繁體中文', flag: '🇹🇼' },
].sort((a, b) => a.label.localeCompare(b.label));

export function resolveTranslationLanguage(code: string): TranslationLanguage | undefined {
  if (!code) return undefined;
  const normalized = code.toLowerCase();
  return ALL_TRANSLATION_LANGUAGES.find(
    (l) => l.code.toLowerCase() === normalized || l.code.toLowerCase().startsWith(normalized)
  );
}

