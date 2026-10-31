/**
 * Normalizes Project Gutenberg plain-text typographic artifacts within a single line or paragraph:
 * 1. Preserves horizontal dividers, scene breaks, and asterisms (`* * *`, `-----`).
 * 2. Converts strictly 2-hyphen prose tokens (`--`) into typographic em-dashes (`—`) while
 *    leaving `+--+` / `|--|` ASCII table borders, `---` rules, and `-->` arrows untouched.
 * 3. Strips genuine Gutenberg `_italic_` emphasis underscores around words/phrases while
 *    leaving Victorian redacted blanks (`Captain ____ of the ____ Regiment`, `17__`) and
 *    `snake_case` identifiers untouched.
 */
export function formatGutenbergTypography(text: string | undefined | null): string {
  if (!text) return '';
  if (/^[\s*\-_~=]{3,}$/.test(text)) {
    return text;
  }

  // 1. Strip Gutenberg _italic_ wrappers where opening/closing underscores tightly hug alphanumeric/quote chars
  const italicPattern =
    /(^|[\s(["'“‘—-])_([A-Za-z0-9"'“‘](?:[^_\n]*?[A-Za-z0-9.!?,;:"'”’])?)_(?=$|[\s.,!?;:)\]"'”’—-])/g;
  let formatted = text.replace(italicPattern, '$1$2').replace(italicPattern, '$1$2');

  // 2. Convert 2-hyphen prose dashes to typographic em-dashes without touching ASCII tables (+--+, |--|) or --- rules
  formatted = formatted.replace(
    /(?<=[A-Za-z0-9_,"'”’.)?!;:]|\s)(?<![-\|+])--(?![-\|+>])(?=[A-Za-z0-9_"'“‘(]|\s|$)/g,
    '—'
  );
  // Also handle leading dialogue / attribution double-hyphens at start of line (e.g. "--He spoke")
  formatted = formatted.replace(/^(\s*)--(?=[A-Za-z0-9"'“‘])/gm, '$1—');

  return formatted;
}

/**
 * Reflows Project Gutenberg plain-text paragraphs by joining single-newline hard wraps
 * into fluid prose blocks while preserving double-spaced paragraph breaks, dialogue,
 * scene breaks, and indented or short-line verse/epigraphs.
 */
export function reflowGutenbergParagraphs(rawText: string | undefined | null): string {
  if (!rawText) return '';
  const normalized = rawText.replace(/\r\n/g, '\n');
  const paragraphs = normalized.split(/\n{2,}/);

  const reflowed = paragraphs.map((para) => {
    if (!para.trim()) return '';

    const lines = para.split('\n').filter((l) => l.trim().length > 0);
    if (lines.length === 0) return '';
    if (lines.length === 1) {
      return formatGutenbergTypography(lines[0].trim());
    }

    const trimmedLengths = lines.map((l) => l.trim().length);
    const maxTrimmedLen = Math.max(...trimmedLengths);
    const avgTrimmedLen =
      trimmedLengths.reduce((sum, len) => sum + len, 0) / trimmedLengths.length;

    // 1. Deeply indented verse / blockquotes (all lines have 4+ leading spaces or tab)
    const allLinesIndented = lines.every((l) => /^\s{4,}|\t/.test(l));

    // 2. Alternating-indent poetry / epigraphs: continuation lines (2..N) have 2+ spaces,
    //    guarded by maxTrimmedLen <= 62 && avgTrimmedLen <= 52 so 70-col hanging-indent
    //    prose speeches in plays unwrap cleanly on mobile viewports.
    const continuationLinesIndented =
      lines.length >= 2 &&
      lines.slice(1).every((l) => /^\s{2,}|\t/.test(l)) &&
      maxTrimmedLen <= 62 &&
      avgTrimmedLen <= 52;

    // 3. Unindented short-line verse stanzas (3+ lines, all < 45 chars)
    const isShortVerse = lines.length >= 3 && maxTrimmedLen < 45;

    if (allLinesIndented || continuationLinesIndented || isShortVerse) {
      return para
        .replace(/^\n+|\n+$/g, '')
        .split('\n')
        .map((line) => formatGutenbergTypography(line))
        .join('\n');
    }

    // Join single newlines with a single space to allow natural browser text wrapping across any column width
    return formatGutenbergTypography(
      lines
        .map((l) => l.trim())
        .filter(Boolean)
        .join(' ')
    );
  });

  return reflowed.filter(Boolean).join('\n\n');
}
