/**
 * @module src/lib/share-card-primitives
 * @scope Shared 1200x630 HTML5 canvas bookplate primitives, Light/Sepia/Dark archival color palettes, privacy-preserving Web Intent builders, and handle/book-salted Base64URL FNV-1a token codecs.
 * @invariant Constrain all client and server canvas geometry to `CARD_DIMENSIONS` (`1200x630`), validate Base64URL token envelopes strictly against `^[A-Za-z0-9_-]{8,64}$`, and bind FNV-1a integrity signatures to an explicit caller namespace (`computeSaltedShareSignature`).
 * @rationale Centralizing palette definitions, word wrapping, archival border ornaments, Web Intent URL formatting, and Base64URL codecs prevents UI or cryptographic drift between book Reading Cards and Scholar Sanctuary Profile Cards.
 * @adr ADR-033, ADR-080
 */

import type { AppTheme } from '@/stores/useThemeStore';

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

export interface ArchivalCardFrameMetrics {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  frameX: number;
  frameY: number;
  frameW: number;
  frameH: number;
  contentX: number;
  contentMaxWidth: number;
}

export const CARD_DIMENSIONS = {
  width: 1200,
  height: 630,
} as const;

export const CARD_PALETTES: Record<AppTheme, ReadingCardPalette> = {
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

  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Draws decorative corner brackets framing the archival share card border.
 */
export function drawCornerOrnaments(
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

/**
 * Safely acquires a Canvas 2D context while guarding against jsdom's unimplemented stub.
 */
export function getSafe2DContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
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
 * Initializes the 1200x630 archival card surface, double-line borders, and corner ornaments.
 */
export function drawCardArchivalFrame(
  canvas: HTMLCanvasElement,
  palette: ReadingCardPalette
): ArchivalCardFrameMetrics | null {
  const ctx = getSafe2DContext(canvas);
  if (!ctx) return null;

  const width = CARD_DIMENSIONS.width;
  const height = CARD_DIMENSIONS.height;
  canvas.width = width;
  canvas.height = height;

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

  return {
    ctx,
    width,
    height,
    frameX,
    frameY,
    frameW,
    frameH,
    contentX: frameX + 64,
    contentMaxWidth: frameW - 128,
  };
}

/**
 * Renders the canonical archival card footer divider, tagline, and canonical site destination.
 */
export function drawCardFooterBar(
  ctx: CanvasRenderingContext2D,
  palette: ReadingCardPalette,
  metrics: Pick<ArchivalCardFrameMetrics, 'width' | 'frameY' | 'frameH' | 'contentX'>,
  tagline: string,
  canonicalPathLabel: string
): void {
  const footerDividerY = metrics.frameY + metrics.frameH - 96;
  ctx.strokeStyle = palette.innerBorder;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(metrics.contentX, footerDividerY);
  ctx.lineTo(metrics.width - metrics.contentX, footerDividerY);
  ctx.stroke();

  const footerTextY = footerDividerY + 42;
  ctx.fillStyle = palette.mutedInk;
  ctx.font = '500 19px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(tagline, metrics.contentX, footerTextY);

  ctx.fillStyle = palette.primaryInk;
  ctx.font = '700 19px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.textAlign = 'right';
  ctx.fillText(canonicalPathLabel, metrics.width - metrics.contentX, footerTextY);
}

/**
 * Exports a rendered HTML5 canvas into a PNG Blob for clipboard copy, download, or Web Share.
 */
export function exportCardBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
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

/**
 * Computes a deterministic 32-bit FNV-1a integrity signature bound to an explicit domain salt,
 * resource key (book ID or normalized handle), and encoded payload.
 */
export function computeSaltedShareSignature(
  salt: string,
  resourceKey: string | number,
  payload: string
): string {
  const input = `${salt}:${String(resourceKey)}:${payload}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/**
 * Encodes a UTF-8 string into an unpadded URL-safe Base64URL token.
 */
export function toBase64Url(input: string): string {
  const base64 =
    typeof Buffer !== 'undefined'
      ? Buffer.from(input, 'utf-8').toString('base64')
      : btoa(input);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

/**
 * Decodes a compact Base64URL share token envelope (`^[A-Za-z0-9_-]{8,64}$`).
 */
export function fromBase64Url(encoded: string): string | null {
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

export function encodeThemeCode(theme: AppTheme): 'l' | 's' | 'd' {
  return theme === 'sepia' ? 's' : theme === 'dark' ? 'd' : 'l';
}

export function decodeThemeCode(code: string): AppTheme | null {
  if (code === 'l') return 'light';
  if (code === 's') return 'sepia';
  if (code === 'd') return 'dark';
  return null;
}
