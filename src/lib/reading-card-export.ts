import type { ReaderTheme } from '@/stores/useReaderStore';
import { SITE_CONFIG } from '@/config/site-config';
import {
  CARD_DIMENSIONS,
  CARD_PALETTES,
  buildSocialShareUrls,
  computeSaltedShareSignature,
  decodeThemeCode,
  drawCardArchivalFrame,
  drawCardFooterBar,
  encodeThemeCode,
  exportCardBlob,
  fromBase64Url,
  toBase64Url,
  wrapCanvasText,
  type ReadingCardPalette,
  type SocialPlatformId,
  type SocialShareTarget,
} from './share-card-primitives';

export {
  CARD_DIMENSIONS,
  CARD_PALETTES,
  wrapCanvasText,
  exportCardBlob as exportReadingCardBlob,
  buildSocialShareUrls,
  type ReadingCardPalette,
  type SocialPlatformId,
  type SocialShareTarget,
};

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

export interface DecodedReadingCardToken {
  theme: ReaderTheme;
  includeProgress: boolean;
  progress: number;
  currentSection: number;
  totalSections: number;
}

/**
 * Renders a 1200x630 archival reading card directly onto an HTML5 Canvas element.
 */
export function renderReadingCardToCanvas(
  canvas: HTMLCanvasElement,
  config: ReadingCardConfig
): boolean {
  const palette = CARD_PALETTES[config.theme] ?? CARD_PALETTES.light;
  const metrics = drawCardArchivalFrame(canvas, palette);
  if (!metrics) return false;

  const { ctx, width, frameY, frameH, contentX, contentMaxWidth } = metrics;
  const safeTitle = config.title.trim() || 'Untitled Volume';
  const safeAuthor = config.author.trim() || 'Classical Author';
  const safeHost = config.siteHost?.trim() || SITE_CONFIG.SITE_HOST;
  const clampedProgress = Math.max(0, Math.min(100, Math.round(config.progress ?? 0)));
  const currentSec = Math.max(1, config.currentSection ?? 1);
  const totalSec = Math.max(currentSec, config.totalSections ?? 1);
  const showProgress = config.includeProgress !== false;

  // 1. Top Archival Header Row
  const headerY = frameY + 66;
  ctx.fillStyle = palette.accent;
  ctx.font = '700 18px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('BOOKARIUM  •  PUBLIC DOMAIN ARCHIVE', contentX, headerY);

  ctx.fillStyle = palette.mutedInk;
  ctx.font = '600 17px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`GUTENBERG #${String(config.bookId)}`, width - contentX, headerY);

  ctx.strokeStyle = palette.innerBorder;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(contentX, headerY + 22);
  ctx.lineTo(width - contentX, headerY + 22);
  ctx.stroke();

  // 2. Book Title (Adaptive Serif Sizing + Multi-Line Wrapping)
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

  // 3. Author Byline
  cursorY += 12;
  ctx.fillStyle = palette.secondaryInk;
  ctx.font = 'italic 400 30px Georgia, "Times New Roman", serif';
  const authorLines = wrapCanvasText(ctx, `by ${safeAuthor}`, contentMaxWidth, 1);
  if (authorLines[0]) {
    ctx.fillText(authorLines[0], contentX, cursorY);
  }

  // 4. Middle Section: Live Reading Progress Bar OR Quote / Edition Badge
  const footerDividerY = frameY + frameH - 96;
  const middleSectionY = Math.min(cursorY + 62, footerDividerY - 94);

  if (showProgress) {
    ctx.fillStyle = palette.accent;
    ctx.font = '700 19px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${clampedProgress}% COMPLETED`, contentX, middleSectionY);

    ctx.fillStyle = palette.mutedInk;
    ctx.font = '600 18px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`SECTION ${currentSec} OF ${totalSec}`, width - contentX, middleSectionY);

    const barY = middleSectionY + 18;
    const barHeight = 14;
    ctx.fillStyle = palette.trackBg;
    ctx.fillRect(contentX, barY, contentMaxWidth, barHeight);

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

  // 5. Footer Citation Bar
  drawCardFooterBar(
    ctx,
    palette,
    metrics,
    'Read free, ad-free & offline on Bookarium',
    `${safeHost}/read/${String(config.bookId)}`
  );

  return true;
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

const SHARE_TOKEN_SALT = 'bookarium-card-sig-v1';

/**
 * Computes a deterministic 32-bit FNV-1a integrity signature bound to bookId and payload.
 */
export function computeShareTokenSignature(bookId: string | number, payload: string): string {
  return computeSaltedShareSignature(SHARE_TOKEN_SALT, bookId, payload);
}

/**
 * Encodes reading card state into a compact, tamper-proof Base64URL token (`?s=<token>`).
 */
export function encodeReadingCardShareToken(config: ReadingCardConfig): string {
  const themeCode = encodeThemeCode(config.theme);
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

  const theme = decodeThemeCode(themeCode);
  if (!theme) return null;
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
