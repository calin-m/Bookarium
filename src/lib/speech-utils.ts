/**
 * Speech synthesis utility helpers
 */

/**
 * Determines if a voice is high-definition Natural / Neural / Enhanced
 */
export function isNaturalVoice(voice: SpeechSynthesisVoice | null | undefined): boolean {
  if (!voice || !voice.name) return false;
  const name = voice.name.toLowerCase();
  return (
    name.includes('natural') ||
    name.includes('neural') ||
    name.includes('online') ||
    name.includes('enhanced') ||
    name.includes('premium') ||
    name.includes('siri') ||
    name.includes('google')
  );
}

/**
 * Strips vendor brand prefixes from voice names for cleaner presentation
 */
export function cleanVoiceName(name: string): string {
  if (!name) return '';
  return name.replace(/(Microsoft|Google|Apple)\s*/gi, '').trim();
}

