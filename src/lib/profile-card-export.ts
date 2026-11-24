/**
 * @module src/lib/profile-card-export
 * @scope Client 1200x630 Scholar Sanctuary Canvas card renderer, human-readable share copy formatter, and handle-salted visual-only `?s=<token>` integrity codec.
 * @invariant Bind `?s=<token>` FNV-1a signatures strictly to the normalized lowercase handle via `'bookarium-profile-card-v1'` and encode ONLY visual display flags (`theme`, `includeStats`) — never embedding client-supplied bio text or reading counts inside URL tokens.
 * @rationale Keeping profile card share URLs free of serialized user claims allows stateless server `/api/profiles/card` renders to verify visibility toggles and live scholar metadata directly against public Supabase rows (ADR-033).
 * @adr ADR-033, ADR-080
 */

import { ROUTES } from '@/config/routes';
import { SITE_CONFIG } from '@/config/site-config';
import type { AppTheme } from '@/stores/useThemeStore';
import {
  CARD_PALETTES,
  computeSaltedShareSignature,
  decodeThemeCode,
  drawCardArchivalFrame,
  drawCardFooterBar,
  encodeThemeCode,
  fromBase64Url,
  toBase64Url,
  wrapCanvasText,
} from './share-card-primitives';

export interface ProfileCardConfig {
  username: string;
  displayName: string;
  initials: string;
  memberSince: string;
  bio?: string | null;
  bioBookTitle?: string | null;
  bioBookAuthor?: string | null;
  theme: AppTheme;
  includeStats?: boolean;
  statsPills?: string[];
  siteHost?: string;
}

export interface DecodedProfileCardToken {
  theme: AppTheme;
  includeStats: boolean;
}

export interface ProfileCardStatsInput {
  showStreak: boolean;
  showChallenge: boolean;
  showBookshelves: boolean;
  currentStreak?: number | null;
  annualGoal?: number | null;
  completedBooksCount?: number | null;
  pinnedAccoladesCount?: number;
  publicShelvesCount?: number | null;
}

const PROFILE_SHARE_TOKEN_SALT = 'bookarium-profile-card-v1';

/**
 * Formats display initials cleanly from display name or scholar handle with safe fallback.
 */
export function resolveScholarInitials(displayName?: string | null, username?: string | null): string {
  const cleanName = displayName?.trim();
  if (cleanName) {
    const parts = cleanName.split(/\s+/);
    if (parts.length >= 2 && parts[0][0] && parts[parts.length - 1][0]) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    if (parts[0]) {
      return parts[0].slice(0, 2).toUpperCase();
    }
  }
  const cleanHandle = username?.trim().replace(/^@+/, '');
  if (cleanHandle) {
    return cleanHandle.slice(0, 2).toUpperCase();
  }
  return 'BS';
}

/**
 * Formats compact, privacy-respecting scholar metric pills (up to 4 pills) shared across both
 * client `<canvas>` cards and server `ImageResponse` cards.
 */
export function buildProfileCardStatPills(input: ProfileCardStatsInput): string[] {
  const pills: string[] = [];

  if (
    input.showStreak &&
    typeof input.currentStreak === 'number' &&
    Number.isFinite(input.currentStreak) &&
    input.currentStreak >= 0
  ) {
    const roundedStreak = Math.round(input.currentStreak);
    pills.push(`${roundedStreak}d Streak`);
  }

  if (
    input.showChallenge &&
    typeof input.annualGoal === 'number' &&
    Number.isFinite(input.annualGoal) &&
    input.annualGoal > 0
  ) {
    const completed = Math.max(0, Math.round(input.completedBooksCount ?? 0));
    const goal = Math.round(input.annualGoal);
    pills.push(`${completed}/${goal} Goal`);
  }

  if (
    typeof input.pinnedAccoladesCount === 'number' &&
    Number.isFinite(input.pinnedAccoladesCount) &&
    input.pinnedAccoladesCount > 0
  ) {
    const count = Math.round(input.pinnedAccoladesCount);
    pills.push(`${count} ${count === 1 ? 'Bookplate' : 'Bookplates'}`);
  }

  if (
    input.showBookshelves &&
    typeof input.publicShelvesCount === 'number' &&
    Number.isFinite(input.publicShelvesCount) &&
    input.publicShelvesCount > 0
  ) {
    const count = Math.round(input.publicShelvesCount);
    pills.push(`${count} ${count === 1 ? 'Shelf' : 'Shelves'}`);
  }

  return pills.slice(0, 4);
}

/**
 * Computes a deterministic 32-bit FNV-1a integrity signature bound to the normalized scholar handle.
 */
export function computeProfileCardTokenSignature(username: string, payload: string): string {
  const normalizedHandle = username.trim().toLowerCase();
  return computeSaltedShareSignature(PROFILE_SHARE_TOKEN_SALT, normalizedHandle, payload);
}

/**
 * Encodes visual card options (`theme` and `includeStats`) into a handle-bound Base64URL token.
 * User profile copy and reading stats are never encoded inside URL tokens.
 */
export function encodeProfileCardShareToken(
  config: Pick<ProfileCardConfig, 'username' | 'theme' | 'includeStats'>
): string {
  const normalizedHandle = config.username.trim().toLowerCase();
  const themeCode = encodeThemeCode(config.theme);
  const incCode = config.includeStats !== false ? '1' : '0';
  const payload = `${themeCode}.${incCode}`;
  const sig = computeProfileCardTokenSignature(normalizedHandle, payload);
  return toBase64Url(`${payload}.${sig}`);
}

/**
 * Verifies and decodes a signed scholar profile share token (`?s=<token>`).
 * Returns null if tampered, malformed, or replayed across a different username.
 */
export function decodeProfileCardShareToken(
  username: string,
  token: string | null | undefined
): DecodedProfileCardToken | null {
  if (!token || typeof token !== 'string') return null;
  const normalizedHandle = username.trim().toLowerCase();
  if (!normalizedHandle) return null;

  const decoded = fromBase64Url(token.trim());
  if (!decoded) return null;

  const parts = decoded.split('.');
  if (parts.length !== 3) return null;

  const [themeCode, incCode, sig] = parts;
  const payload = `${themeCode}.${incCode}`;
  const expectedSig = computeProfileCardTokenSignature(normalizedHandle, payload);
  if (sig !== expectedSig) return null;

  const theme = decodeThemeCode(themeCode);
  if (!theme) return null;
  if (incCode !== '0' && incCode !== '1') return null;

  return {
    theme,
    includeStats: incCode === '1',
  };
}

/**
 * Builds the canonical signed share URL (`/u/<username>?s=<token>`) for Scholar Sanctuary unfurling.
 */
export function buildProfileCardShareUrl(
  origin: string,
  config: Pick<ProfileCardConfig, 'username' | 'theme' | 'includeStats'>
): string {
  const cleanOrigin = origin.replace(/\/+$/, '');
  const cleanHandle = config.username.trim().toLowerCase();
  if (!cleanHandle) {
    return `${cleanOrigin}/`;
  }
  const token = encodeProfileCardShareToken({ ...config, username: cleanHandle });
  return `${cleanOrigin}${ROUTES.PUBLIC_PROFILE(cleanHandle)}?s=${token}`;
}

/**
 * Formats human-readable social share copy for a public scholar profile card.
 */
export function buildProfileShareText(config: ProfileCardConfig): string {
  const cleanHandle = config.username.trim().toLowerCase();
  const safeName = config.displayName.trim() || (cleanHandle ? `@${cleanHandle}` : 'Bookarium Scholar');
  const handleRef = cleanHandle ? ` (@${cleanHandle})` : '';
  const trimmedBio = config.bio?.trim();

  if (trimmedBio) {
    const excerpt = trimmedBio.length > 105 ? `${trimmedBio.slice(0, 102).trimEnd()}…` : trimmedBio;
    return `“${excerpt}” — Explore ${safeName}${handleRef}'s Scholar Sanctuary on Bookarium.`;
  }

  return `Explore ${safeName}${handleRef}'s curated public bookshelves and reading sanctuary on Bookarium.`;
}

/**
 * Renders a 1200x630 archival Scholar Sanctuary card directly onto an HTML5 Canvas element.
 */
export function renderProfileCardToCanvas(
  canvas: HTMLCanvasElement,
  config: ProfileCardConfig
): boolean {
  const palette = CARD_PALETTES[config.theme] ?? CARD_PALETTES.light;
  const metrics = drawCardArchivalFrame(canvas, palette);
  if (!metrics) return false;

  const { ctx, width, frameY, frameH, contentX, contentMaxWidth } = metrics;
  const cleanHandle = config.username.trim().toLowerCase() || 'scholar';
  const safeName = config.displayName.trim() || `@${cleanHandle}`;
  const safeInitials = (config.initials.trim() || resolveScholarInitials(safeName, cleanHandle)).slice(0, 2).toUpperCase();
  const safeMemberSince = config.memberSince.trim() || 'Ancient Scholar';
  const safeHost = config.siteHost?.trim() || SITE_CONFIG.SITE_HOST;
  const footerDividerY = frameY + frameH - 96;

  // 1. Top Archival Header Row
  const headerY = frameY + 62;
  ctx.fillStyle = palette.accent;
  ctx.font = '700 18px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('BOOKARIUM  •  PUBLIC SCHOLAR', contentX, headerY);

  ctx.fillStyle = palette.mutedInk;
  ctx.font = '600 16px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`SCHOLAR SINCE ${safeMemberSince.toUpperCase()}`, width - contentX, headerY);

  ctx.strokeStyle = palette.innerBorder;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(contentX, headerY + 20);
  ctx.lineTo(width - contentX, headerY + 20);
  ctx.stroke();

  // 2. Monogram Seal + Scholar Identity Row
  const identityTopY = headerY + 46;
  const sealRadius = 34;
  const sealCenterX = contentX + sealRadius;
  const sealCenterY = identityTopY + sealRadius + 2;

  ctx.save();
  ctx.fillStyle = palette.accentSoft;
  ctx.strokeStyle = palette.accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(sealCenterX, sealCenterY, sealRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = palette.accent;
  ctx.font = '700 24px Georgia, "Times New Roman", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(safeInitials, sealCenterX, sealCenterY + 1);
  ctx.restore();

  const textStartX = contentX + sealRadius * 2 + 24;
  const nameMaxWidth = width - contentX - textStartX;
  ctx.fillStyle = palette.primaryInk;
  ctx.font = '700 42px Georgia, "Times New Roman", serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const nameLines = wrapCanvasText(ctx, safeName, nameMaxWidth, 1);
  if (nameLines[0]) {
    ctx.fillText(nameLines[0], textStartX, identityTopY + 34);
  }

  ctx.fillStyle = palette.accent;
  ctx.font = '600 21px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText(`@${cleanHandle}`, textStartX, identityTopY + 66);

  // 3. Literary Motto + Optional Source Volume Attribution (Issue #24)
  let cursorY = identityTopY + 124;
  const trimmedBio = config.bio?.trim();
  if (trimmedBio) {
    ctx.fillStyle = palette.secondaryInk;
    ctx.font = 'italic 400 26px Georgia, "Times New Roman", serif';
    const bioLines = wrapCanvasText(ctx, `“${trimmedBio}”`, contentMaxWidth, 2);
    for (const line of bioLines) {
      ctx.fillText(line, contentX, cursorY);
      cursorY += 35;
    }

    const attrTitle = config.bioBookTitle?.trim();
    if (attrTitle) {
      const attrAuthor = config.bioBookAuthor?.trim();
      const attrText = attrAuthor ? `— ${attrTitle}, ${attrAuthor}` : `— ${attrTitle}`;
      ctx.fillStyle = palette.mutedInk;
      ctx.font = '500 18px system-ui, -apple-system, sans-serif';
      const attrLines = wrapCanvasText(ctx, attrText, contentMaxWidth, 1);
      if (attrLines[0]) {
        ctx.fillText(attrLines[0], contentX, cursorY + 2);
      }
    }
  } else {
    ctx.fillStyle = palette.secondaryInk;
    ctx.font = 'italic 400 25px Georgia, "Times New Roman", serif';
    const fallbackLines = wrapCanvasText(
      ctx,
      'Curated public domain shelves, pinned Ex-Libris bookplates, and personal reading milestones.',
      contentMaxWidth,
      2
    );
    for (const line of fallbackLines) {
      ctx.fillText(line, contentX, cursorY);
      cursorY += 34;
    }
  }

  // 4. Optional Privacy-Gated Summary Stats Pills
  const pills = config.includeStats !== false ? config.statsPills ?? [] : [];
  if (pills.length > 0) {
    const pillY = footerDividerY - 56;
    const pillHeight = 36;
    const pillPadX = 16;
    const pillGap = 12;
    let currentX = contentX;

    ctx.font = '600 16px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'left';

    for (const pill of pills) {
      const textWidth = ctx.measureText(pill).width;
      const boxWidth = Math.round(textWidth + pillPadX * 2);
      if (currentX + boxWidth > width - contentX) {
        break;
      }

      ctx.fillStyle = palette.accentSoft;
      ctx.fillRect(currentX, pillY, boxWidth, pillHeight);
      ctx.strokeStyle = palette.innerBorder;
      ctx.lineWidth = 1;
      ctx.strokeRect(currentX, pillY, boxWidth, pillHeight);

      ctx.fillStyle = palette.accent;
      ctx.fillText(pill, currentX + pillPadX, pillY + 23);
      currentX += boxWidth + pillGap;
    }
  }

  // 5. Footer Citation Bar
  drawCardFooterBar(
    ctx,
    palette,
    metrics,
    'Curated Public Domain Sanctuary on Bookarium',
    `${safeHost}${ROUTES.PUBLIC_PROFILE(cleanHandle)}`
  );

  return true;
}
