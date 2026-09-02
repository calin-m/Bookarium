/**
 * Reflows Project Gutenberg plain-text paragraphs by joining single-newline hard wraps
 * into fluid prose blocks while preserving double-spaced paragraph breaks, dialogue, and verse.
 */
export function reflowGutenbergParagraphs(rawText: string | undefined | null): string {
  if (!rawText) return '';
  const normalized = rawText.replace(/\r\n/g, '\n');
  const paragraphs = normalized.split(/\n{2,}/);

  const reflowed = paragraphs.map((para) => {
    if (!para.trim()) return '';

    const lines = para.split('\n');
    if (lines.length <= 1) return para.trim();

    // In Project Gutenberg, standard paragraphs often start with 2-5 spaces on the first line only.
    // Verse/poetry or blockquotes have all lines deeply indented (4+ spaces) or all lines are very short (< 45 chars).
    const allLinesIndented = lines.length > 1 && lines.every((l) => /^\s{4,}|\t/.test(l));
    const isShortVerse = lines.length > 2 && lines.every((l) => l.trim().length > 0 && l.trim().length < 45);

    if (allLinesIndented || isShortVerse) {
      return para.replace(/^\n+|\n+$/g, '');
    }

    // Join single newlines with a single space to allow natural browser text wrapping across any column width
    return lines
      .map((l) => l.trim())
      .filter(Boolean)
      .join(' ');
  });

  return reflowed.filter(Boolean).join('\n\n');
}

