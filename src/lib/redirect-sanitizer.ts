import { SITE_CONFIG } from '@/config/site-config';

/**
 * Sanitizes and validates internal redirect paths to prevent Open Redirect vulnerabilities.
 * Ensures the destination starts with a single leading slash and contains no protocol-relative
 * double slashes (//) or backslashes (/\).
 */
export function sanitizeRedirectPath(path: string | null): string {
  if (!path) return '/';
  const trimmed = path.trim();
  // Must start with a single slash and not double slashes (//) or backslashes (/\ or \)
  if (/^\/[^\/\\]/.test(trimmed) || trimmed === '/') {
    return trimmed;
  }
  return '/';
}

/**
 * Resolves the canonical public authentication origin so preview deployment domains
 * (e.g. `https://bookarium-git-*.vercel.app` or `https://bookarium-<hash>.vercel.app`,
 * which are gated behind Vercel Deployment Protection) never leak into Supabase
 * confirmation or magic-link emails.
 *
 * - Preserves `http://localhost:*` and `http://127.0.0.1:*` for local development.
 * - Normalizes any non-local origin to `configuredSiteUrl` (defaults to `SITE_CONFIG.SITE_URL`).
 */
export function resolveCanonicalAuthOrigin(
  currentOrigin?: string,
  configuredSiteUrl: string = SITE_CONFIG.SITE_URL
): string {
  const canonicalFallback = configuredSiteUrl.replace(/\/+$/, '');
  if (!currentOrigin) {
    return canonicalFallback;
  }

  try {
    const parsed = new URL(currentOrigin);
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      return parsed.origin;
    }
  } catch {
    return canonicalFallback;
  }

  return canonicalFallback;
}

/**
 * Builds a complete, origin-safe redirect URL for Supabase authentication emails and OAuth callbacks.
 */
export function buildAuthRedirectUrl(
  path: string = '/auth/callback',
  currentOrigin?: string,
  configuredSiteUrl: string = SITE_CONFIG.SITE_URL
): string {
  const origin =
    currentOrigin ?? (typeof window !== 'undefined' ? window.location.origin : undefined);
  const canonicalOrigin = resolveCanonicalAuthOrigin(origin, configuredSiteUrl);
  const safePath = sanitizeRedirectPath(path);
  return `${canonicalOrigin}${safePath}`;
}

/**
 * Resolves the active deployment origin for shareable links while blocking untrusted protocols
 * and normalizing ephemeral Vercel preview URLs (`*-git-*.vercel.app`) to the production domain.
 */
export function resolveCanonicalShareOrigin(
  currentOrigin?: string,
  configuredSiteUrl: string = SITE_CONFIG.SITE_URL
): string {
  const canonicalFallback = configuredSiteUrl.replace(/\/+$/, '');
  if (!currentOrigin) {
    return canonicalFallback;
  }

  try {
    const parsed = new URL(currentOrigin);
    if (
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') &&
      (parsed.protocol === 'http:' || parsed.protocol === 'https:')
    ) {
      return parsed.origin;
    }

    if (parsed.protocol === 'https:') {
      const fallbackHost = new URL(canonicalFallback).hostname;
      if (parsed.hostname.endsWith('.vercel.app') && parsed.hostname !== fallbackHost) {
        return canonicalFallback;
      }
      return parsed.origin;
    }
  } catch {
    return canonicalFallback;
  }

  return canonicalFallback;
}

/**
 * Builds a dynamic, origin-validated share URL for a specific book volume (`/read/:id`).
 */
export function buildBookShareUrl(
  bookId: number | string,
  currentOrigin?: string,
  configuredSiteUrl: string = SITE_CONFIG.SITE_URL
): string {
  const origin =
    currentOrigin ?? (typeof window !== 'undefined' ? window.location.origin : undefined);
  const canonicalOrigin = resolveCanonicalShareOrigin(origin, configuredSiteUrl);
  const normalizedId = String(bookId ?? '').trim();
  if (!/^\d{1,8}$/.test(normalizedId)) {
    return `${canonicalOrigin}/`;
  }
  const safePath = sanitizeRedirectPath(`/read/${normalizedId}`);
  return `${canonicalOrigin}${safePath}`;
}



