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

/**
 * Scores a voice based on quality indicators (Neural/Natural/Enhanced)
 * and language compatibility.
 */
export function getVoiceQualityScore(
  voice: SpeechSynthesisVoice | null | undefined,
  targetLang: string = 'en'
): number {
  if (!voice) return 0;
  let score = 0;
  const combined = `${voice.name || ''} ${voice.voiceURI || ''}`.toLowerCase();

  // Language match priority
  if (isVoiceLanguageCompatible(voice, targetLang)) {
    score += 100;
  }

  // Modern Neural / Natural engine prioritization
  if (combined.includes('natural') || combined.includes('online')) score += 50;
  if (combined.includes('neural') || combined.includes('wavenet')) score += 40;
  if (combined.includes('enhanced') || combined.includes('premium') || combined.includes('network')) {
    score += 30;
  }
  if (combined.includes('siri')) score += 25;
  if (combined.includes('google') || voice.localService === false) score += 20;

  // Demote legacy mechanical voices
  if (combined.includes('espeak') || combined.includes('desktop')) score -= 15;

  return score;
}

/**
 * Sorts voices descending by quality score and language compatibility.
 */
export function sortVoicesByQuality(
  voices: SpeechSynthesisVoice[],
  targetLang: string = 'en'
): SpeechSynthesisVoice[] {
  if (!voices || !Array.isArray(voices)) return [];
  return [...voices].sort(
    (a, b) => getVoiceQualityScore(b, targetLang) - getVoiceQualityScore(a, targetLang)
  );
}

/**
 * Resolves the optimal voice given a pool of available voices, an optional
 * preferred voice URI, and target language.
 */
export function resolveBestVoice(
  voices: SpeechSynthesisVoice[],
  preferredVoiceURI?: string | null,
  targetLang: string = 'en'
): SpeechSynthesisVoice | null {
  if (!voices || voices.length === 0) return null;

  const sorted = sortVoicesByQuality(voices, targetLang);
  const compatible = sorted.filter((v) => isVoiceLanguageCompatible(v, targetLang));
  const pool = compatible.length > 0 ? compatible : sorted;

  if (preferredVoiceURI) {
    const matched =
      pool.find((v) => v.voiceURI === preferredVoiceURI || v.name === preferredVoiceURI) ||
      sorted.find((v) => v.voiceURI === preferredVoiceURI || v.name === preferredVoiceURI);
    if (matched) return matched;
  }

  return pool[0] || null;
}

