/**
 * Speech synthesis utility helpers
 */

/**
 * Normalizes OS/WebView speech locale strings (e.g. Android "en_US" -> BCP-47 "en-US").
 */
export function normalizeSpeechLang(lang: string | null | undefined): string {
  if (!lang || typeof lang !== 'string') return '';
  return lang.trim().replace(/_/g, '-');
}

/**
 * Checks whether a SpeechSynthesisVoice is compatible with the target book language
 * by matching the primary ISO 639 language subtag (e.g. "en" matches "en", "en-US", "en_GB", "en-AU").
 */
export function isVoiceLanguageCompatible(
  voice: SpeechSynthesisVoice | null | undefined,
  targetLang: string | null | undefined
): boolean {
  if (!voice || !voice.lang) return false;
  const normalizedTarget = normalizeSpeechLang(targetLang || 'en').toLowerCase();
  const primaryTarget = normalizedTarget.split('-')[0];
  if (!primaryTarget) return true;

  const normalizedVoiceLang = normalizeSpeechLang(voice.lang).toLowerCase();
  const primaryVoiceLang = normalizedVoiceLang.split('-')[0];
  return primaryVoiceLang === primaryTarget;
}

/**
 * Determines if a voice is high-definition Natural / Neural / Enhanced / Cloud-Synthesized
 * across desktop and mobile/tablet browsers (inspecting both voice.name, voice.voiceURI, and localService).
 */
export function isNaturalVoice(voice: SpeechSynthesisVoice | null | undefined): boolean {
  if (!voice || !voice.name) return false;
  const combined = `${voice.name} ${voice.voiceURI || ''}`.toLowerCase();
  if (combined.includes('espeak') || combined.includes('desktop')) {
    return false;
  }
  return (
    combined.includes('natural') ||
    combined.includes('neural') ||
    combined.includes('online') ||
    combined.includes('enhanced') ||
    combined.includes('premium') ||
    combined.includes('siri') ||
    combined.includes('google') ||
    combined.includes('wavenet') ||
    combined.includes('network') ||
    voice.localService === false
  );
}

/**
 * Strips vendor brand prefixes from voice names for cleaner presentation
 */
export function cleanVoiceName(name: string): string {
  if (!name) return '';
  return name.replace(/(Microsoft|Google|Apple)\s*/gi, '').trim();
}

