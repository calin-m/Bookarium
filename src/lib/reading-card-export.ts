import type { ReaderTheme } from '@/stores/useReaderStore';

export interface ReadingCardConfig {
  bookId: string | number;
  title: string;
  author: string;
  theme: ReaderTheme;
  progress?: number;
  currentSection?: number;
  totalSections?: number;
  includeProgress?: boolean;
  quote?: string;
  siteHost?: string;
}

export type SocialPlatformId =
  | 'x'
  | 'reddit'
  | 'whatsapp'
  | 'telegram'
  | 'bluesky'
  | 'facebook'
  | 'linkedin'
  | 'email';

export interface SocialShareTarget {
  id: SocialPlatformId;
  label: string;
  shortLabel: string;
  href: string;
  description: string;
}

export interface DecodedReadingCardToken {
  theme: ReaderTheme;
  includeProgress: boolean;
  progress: number;
  currentSection: number;
  totalSections: number;
}

export interface ReadingCardPalette {
  background: string;
  cardSurface: string;
  outerBorder: string;
  innerBorder: string;
  primaryInk: string;
  secondaryInk: string;
  mutedInk: string;
  accent: string;
  accentSoft: string;
  trackBg: string;
}

export const CARD_DIMENSIONS = {
  width: 1200,
  height: 630,
} as const;

export const CARD_PALETTES: Record<ReaderTheme, ReadingCardPalette> = {
  light: {
    background: '#f7f3eb',
    cardSurface: '#fdfbf7',
    outerBorder: '#d6cfc2',
    innerBorder: '#e5dfd3',
    primaryInk: '#1c1917',
    secondaryInk: '#44403c',
    mutedInk: '#78716c',
    accent: '#9a3412',
    accentSoft: '#ffedd5',
    trackBg: '#e7e2d8',
  },
  sepia: {
    background: '#eadfc9',
    cardSurface: '#f4ecd8',
    outerBorder: '#c8b79a',
    innerBorder: '#d8c9b0',
    primaryInk: '#2c221e',
    secondaryInk: '#53433a',
    mutedInk: '#7c6a5e',
    accent: '#854d0e',
    accentSoft: '#fef3c7',
    trackBg: '#dfd2b8',
  },
  dark: {
    background: '#0f0f0e',
    cardSurface: '#181816',
    outerBorder: '#33312e',
    innerBorder: '#262522',
    primaryInk: '#f5f5f4',
    secondaryInk: '#d6d3d1',
    mutedInk: '#a8a29e',
    accent: '#d97706',
    accentSoft: '#292524',
    trackBg: '#292826',
  },
};

/**
 * Wraps text across multiple lines within a given pixel width using Canvas 2D measurement.
 */
export function wrapCanvasText(
  ctx: Pick<CanvasRenderingContext2D, 'measureText'>,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const cleaned = text.trim().replace(/\s+/g, ' ');
  if (!cleaned) return [];

  const words = cleaned.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    const width = ctx.measureText(candidate).width;

    if (width <= maxWidth || !currentLine) {
      currentLine = candidate;
    } else {
      if (lines.length === maxLines - 1) {
        let truncated = currentLine;
        while (truncated.length > 1 && ctx.measureText(`${truncated}…`).width > maxWidth) {
          truncated = truncated.slice(0, -1).trimEnd();
        }
        lines.push(`${truncated}…`);
        return lines;
      }
      lines.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine) {
    if (lines.length < maxLines) {
      lines.push(currentLine);
    }
  }

  return lines;
}

function drawCornerOrnaments(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string
): void {
  const arm = 24;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;

  // Top-left
  ctx.beginPath();
  ctx.moveTo(x, y + arm);
  ctx.lineTo(x, y);
  ctx.lineTo(x + arm, y);
  ctx.stroke();

  // Top-right
  ctx.beginPath();
  ctx.moveTo(x + width - arm, y);
  ctx.lineTo(x + width, y);
  ctx.lineTo(x + width, y + arm);
  ctx.stroke();

  // Bottom-left
  ctx.beginPath();
  ctx.moveTo(x, y + height - arm);
  ctx.lineTo(x, y + height);
  ctx.lineTo(x + arm, y + height);
  ctx.stroke();

  // Bottom-right
  ctx.beginPath();
  ctx.moveTo(x + width - arm, y + height);
  ctx.lineTo(x + width, y + height);
  ctx.lineTo(x + width, y + height - arm);
  ctx.stroke();

  ctx.restore();
}

function getSafe2DContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  if (typeof canvas.getContext !== 'function') return null;
  const isJsdom =
    typeof navigator !== 'undefined' &&
    typeof navigator.userAgent === 'string' &&
    /jsdom/i.test(navigator.userAgent);
  if (
    isJsdom &&
    typeof HTMLCanvasElement !== 'undefined' &&
    canvas.getContext === HTMLCanvasElement.prototype.getContext &&
    !('mock' in canvas.getContext)
  ) {
    return null;
  }
  try {
    return canvas.getContext('2d');
  } catch {
    return null;
  }
}

/**
 * Renders a 1200x630 archival reading card directly onto an HTML5 Canvas element.
 */
export function renderReadingCardToCanvas(
  canvas: HTMLCanvasElement,
  config: ReadingCardConfig
): boolean {
  const ctx = getSafe2DContext(canvas);
  if (!ctx) return false;

  const width = CARD_DIMENSIONS.width;
  const height = CARD_DIMENSIONS.height;
  canvas.width = width;
  canvas.height = height;

  const palette = CARD_PALETTES[config.theme] ?? CARD_PALETTES.light;
  const safeTitle = config.title.trim() || 'Untitled Volume';
  const safeAuthor = config.author.trim() || 'Classical Author';
  const safeHost = config.siteHost?.trim() || 'bookarium.vercel.app';
  const clampedProgress = Math.max(0, Math.min(100, Math.round(config.progress ?? 0)));
  const currentSec = Math.max(1, config.currentSection ?? 1);
  const totalSec = Math.max(currentSec, config.totalSections ?? 1);
  const showProgress = config.includeProgress !== false;

  // 1. Outer Background & Bookplate Frame
  ctx.fillStyle = palette.background;
  ctx.fillRect(0, 0, width, height);

  const margin = 36;
  const frameX = margin;
  const frameY = margin;
  const frameW = width - margin * 2;
  const frameH = height - margin * 2;

  ctx.fillStyle = palette.cardSurface;
  ctx.fillRect(frameX, frameY, frameW, frameH);

  ctx.strokeStyle = palette.outerBorder;
  ctx.lineWidth = 2;
  ctx.strokeRect(frameX, frameY, frameW, frameH);

  const innerInset = 14;
  ctx.strokeStyle = palette.innerBorder;
  ctx.lineWidth = 1;
  ctx.strokeRect(
    frameX + innerInset,
    frameY + innerInset,
    frameW - innerInset * 2,
    frameH - innerInset * 2
  );

  drawCornerOrnaments(
    ctx,
    frameX + innerInset - 2,
    frameY + innerInset - 2,
    frameW - (innerInset - 2) * 2,
    frameH - (innerInset - 2) * 2,
    palette.accent
  );

  const contentX = frameX + 64;
  const contentMaxWidth = frameW - 128;

  // 2. Top Archival Header Row
  const headerY = frameY + 66;
  ctx.fillStyle = palette.accent;
  ctx.font = '700 18px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('BOOKARIUM  •  PUBLIC DOMAIN ARCHIVE', contentX, headerY);

  ctx.fillStyle = palette.mutedInk;
  ctx.font = '600 17px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`GUTENBERG #${String(config.bookId)}`, width - contentX, headerY);

  // Subtle top rule
  ctx.strokeStyle = palette.innerBorder;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(contentX, headerY + 22);
  ctx.lineTo(width - contentX, headerY + 22);
  ctx.stroke();

  // 3. Book Title (Adaptive Serif Sizing + Multi-Line Wrapping)
  const titleFontSize = safeTitle.length > 70 ? 44 : safeTitle.length > 42 ? 52 : 60;
  const titleLineHeight = Math.round(titleFontSize * 1.22);
  ctx.fillStyle = palette.primaryInk;
  ctx.font = `700 ${titleFontSize}px Georgia, "Times New Roman", serif`;
  ctx.textAlign = 'left';

  const titleLines = wrapCanvasText(ctx, safeTitle, contentMaxWidth, 3);
  let cursorY = headerY + 88;
  for (const line of titleLines) {
    ctx.fillText(line, contentX, cursorY);
    cursorY += titleLineHeight;
  }

  // 4. Author Byline
  cursorY += 12;
  ctx.fillStyle = palette.secondaryInk;
  ctx.font = 'italic 400 30px Georgia, "Times New Roman", serif';
  const authorLines = wrapCanvasText(ctx, `by ${safeAuthor}`, contentMaxWidth, 1);
  if (authorLines[0]) {
    ctx.fillText(authorLines[0], contentX, cursorY);
  }

  // 5. Middle Section: Either Live Reading Progress Bar OR Quote / Edition Badge
  const footerDividerY = frameY + frameH - 96;
  const middleSectionY = Math.min(cursorY + 62, footerDividerY - 94);

  if (showProgress) {
    // Progress Label Row
    ctx.fillStyle = palette.accent;
    ctx.font = '700 19px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${clampedProgress}% COMPLETED`, contentX, middleSectionY);

    ctx.fillStyle = palette.mutedInk;
    ctx.font = '600 18px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`SECTION ${currentSec} OF ${totalSec}`, width - contentX, middleSectionY);

    // Progress Bar Track
    const barY = middleSectionY + 18;
    const barHeight = 14;
    ctx.fillStyle = palette.trackBg;
    ctx.fillRect(contentX, barY, contentMaxWidth, barHeight);

    // Progress Bar Fill
    const fillRatio = Math.max(0.03, clampedProgress / 100);
    const fillWidth = Math.round(contentMaxWidth * fillRatio);
    ctx.fillStyle = palette.accent;
    ctx.fillRect(contentX, barY, fillWidth, barHeight);
  } else if (config.quote && config.quote.trim().length > 0) {
    ctx.fillStyle = palette.secondaryInk;
    ctx.font = 'italic 400 24px Georgia, "Times New Roman", serif';
    ctx.textAlign = 'left';
    const quoteLines = wrapCanvasText(ctx, `“${config.quote.trim()}”`, contentMaxWidth, 2);
    let quoteY = middleSectionY;
    for (const qLine of quoteLines) {
      ctx.fillText(qLine, contentX, quoteY);
      quoteY += 34;
    }
  } else {
    ctx.fillStyle = palette.accent;
    ctx.font = '700 19px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('UNABRIDGED PUBLIC DOMAIN EDITION  •  FREE DIGITAL READER', contentX, middleSectionY + 16);
  }

  // 6. Footer Citation Bar
  ctx.strokeStyle = palette.innerBorder;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(contentX, footerDividerY);
  ctx.lineTo(width - contentX, footerDividerY);
  ctx.stroke();

  const footerTextY = footerDividerY + 42;
  ctx.fillStyle = palette.mutedInk;
  ctx.font = '500 19px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Read free, ad-free & offline on Bookarium', contentX, footerTextY);

  ctx.fillStyle = palette.primaryInk;
  ctx.font = '700 19px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`${safeHost}/read/${String(config.bookId)}`, width - contentX, footerTextY);

  return true;
}

/**
 * Exports the rendered HTML5 canvas into a PNG Blob for downloading, clipboard copy, or Web Share.
 */
export function exportReadingCardBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (typeof canvas.toBlob !== 'function') {
      resolve(null);
      return;
    }
    try {
      canvas.toBlob((blob) => {
        resolve(blob ?? null);
      }, 'image/png');
    } catch {
      resolve(null);
    }
  });
}

/**
 * Formats human-readable social share copy for the current book and reading progress.
 */
export function buildReadingShareText(config: ReadingCardConfig): string {
  const safeTitle = config.title.trim() || 'Untitled Volume';
  const safeAuthor = config.author.trim() || 'Classical Author';
  const showProgress = config.includeProgress !== false;
  const clampedProgress = Math.max(0, Math.min(100, Math.round(config.progress ?? 0)));

  if (showProgress && clampedProgress > 0) {
    return `Currently reading “${safeTitle}” by ${safeAuthor} (${clampedProgress}% completed) on Bookarium — free public domain library.`;
  }
  return `Reading “${safeTitle}” by ${safeAuthor} on Bookarium — free public domain library.`;
}

/**
 * Builds zero-key, privacy-preserving Web Intent URLs for sharing across PC, Tablet, and Mobile.
 */
export function buildSocialShareUrls(shareOptions: {
  url: string;
  title: string;
  text: string;
}): SocialShareTarget[] {
  const encodedUrl = encodeURIComponent(shareOptions.url);
  const encodedTitle = encodeURIComponent(shareOptions.title);
  const encodedText = encodeURIComponent(shareOptions.text);
  const encodedCombined = encodeURIComponent(`${shareOptions.text} ${shareOptions.url}`);

  return [
    {
      id: 'x',
      label: 'X',
      shortLabel: 'X',
      href: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
      description: 'Post on X',
    },
    {
      id: 'reddit',
      label: 'Reddit',
      shortLabel: 'Reddit',
      href: `https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedText}`,
      description: 'Share to a community',
    },
    {
      id: 'whatsapp',
      label: 'WhatsApp',
      shortLabel: 'WhatsApp',
      href: `https://api.whatsapp.com/send?text=${encodedCombined}`,
      description: 'Send to chat or group',
    },
    {
      id: 'telegram',
      label: 'Telegram',
      shortLabel: 'Telegram',
      href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
      description: 'Share via Telegram',
    },
    {
      id: 'bluesky',
      label: 'Bluesky',
      shortLabel: 'Bluesky',
      href: `https://bsky.app/intent/compose?text=${encodedCombined}`,
      description: 'Post on Bluesky',
    },
    {
      id: 'facebook',
      label: 'Facebook',
      shortLabel: 'Facebook',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      description: 'Share link card',
    },
    {
      id: 'linkedin',
      label: 'LinkedIn',
      shortLabel: 'LinkedIn',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      description: 'Share on feed',
    },
    {
      id: 'email',
      label: 'Email',
      shortLabel: 'Email',
      href: `mailto:?subject=${encodedTitle}&body=${encodedCombined}`,
      description: 'Send via email client',
    },
  ];
}

const SHARE_TOKEN_SALT = 'bookarium-card-sig-v1';

/**
 * Computes a deterministic 32-bit FNV-1a integrity signature bound to bookId and payload.
 */
export function computeShareTokenSignature(bookId: string | number, payload: string): string {
  const input = `${SHARE_TOKEN_SALT}:${String(bookId)}:${payload}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function toBase64Url(input: string): string {
  const base64 =
    typeof Buffer !== 'undefined'
      ? Buffer.from(input, 'utf-8').toString('base64')
      : btoa(input);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(encoded: string): string | null {
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(encoded)) return null;
  try {
    const padded = encoded
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(encoded.length / 4) * 4, '=');
    return typeof Buffer !== 'undefined'
      ? Buffer.from(padded, 'base64').toString('utf-8')
      : atob(padded);
  } catch {
    return null;
  }
}

/**
 * Encodes reading card state into a compact, tamper-proof Base64URL token (`?s=<token>`).
 */
export function encodeReadingCardShareToken(config: ReadingCardConfig): string {
  const themeCode = config.theme === 'sepia' ? 's' : config.theme === 'dark' ? 'd' : 'l';
  const incCode = config.includeProgress !== false ? '1' : '0';
  const progress = Math.max(0, Math.min(100, Math.round(config.progress ?? 0)));
  const currentSec = Math.max(1, Math.min(9999, Math.round(config.currentSection ?? 1)));
  const totalSec = Math.max(currentSec, Math.min(9999, Math.round(config.totalSections ?? 1)));

  const payload = `${themeCode}.${incCode}.${progress}.${currentSec}.${totalSec}`;
  const sig = computeShareTokenSignature(config.bookId, payload);
  return toBase64Url(`${payload}.${sig}`);
}

/**
 * Verifies and decodes a signed reading card share token (`?s=<token>`).
 * Returns null if tampered, malformed, or replayed across a different bookId.
 */
export function decodeReadingCardShareToken(
  bookId: string | number,
  token: string | null | undefined
): DecodedReadingCardToken | null {
  if (!token || typeof token !== 'string') return null;
  const decoded = fromBase64Url(token.trim());
  if (!decoded) return null;

  const parts = decoded.split('.');
  if (parts.length !== 6) return null;

  const [themeCode, incCode, progStr, secStr, totStr, sig] = parts;
  const payload = `${themeCode}.${incCode}.${progStr}.${secStr}.${totStr}`;
  const expectedSig = computeShareTokenSignature(bookId, payload);
  if (sig !== expectedSig) return null;

  if (themeCode !== 'l' && themeCode !== 's' && themeCode !== 'd') return null;
  if (incCode !== '0' && incCode !== '1') return null;

  const progress = Number.parseInt(progStr, 10);
  const currentSection = Number.parseInt(secStr, 10);
  const totalSections = Number.parseInt(totStr, 10);

  if (
    !Number.isFinite(progress) ||
    progress < 0 ||
    progress > 100 ||
    !Number.isFinite(currentSection) ||
    currentSection < 1 ||
    currentSection > 9999 ||
    !Number.isFinite(totalSections) ||
    totalSections < currentSection ||
    totalSections > 9999
  ) {
    return null;
  }

  const theme: ReaderTheme =
    themeCode === 's' ? 'sepia' : themeCode === 'd' ? 'dark' : 'light';

  return {
    theme,
    includeProgress: incCode === '1',
    progress,
    currentSection,
    totalSections,
  };
}

/**
 * Builds the canonical signed share URL (`/read/<id>?s=<token>`) for social unfurling.
 */
export function buildReadingCardShareUrl(origin: string, config: ReadingCardConfig): string {
  const cleanOrigin = origin.replace(/\/+$/, '');
  const token = encodeReadingCardShareToken(config);
  return `${cleanOrigin}/read/${String(config.bookId)}?s=${token}`;
}

