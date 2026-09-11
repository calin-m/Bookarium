import { type NextRequest } from 'next/server';
import { normalizeCountryCode } from './copyright-engine';

export const GEO_COOKIE_NAME = 'bookarium-geo-country';
export const DEV_OVERRIDE_COOKIE_NAME = 'bookarium-dev-country-override';

/**
 * Common IANA Timezone to ISO 3166-1 alpha-2 country code dictionary.
 * Used in local development to automatically mirror the developer's physical jurisdiction
 * with 0ms latency, zero external network dependencies, and full offline resilience.
 */
export const TIMEZONE_COUNTRY_MAP: Record<string, string> = {
  // Eastern Europe
  'Europe/Bucharest': 'RO',
  'Europe/Chisinau': 'MD',
  'Europe/Kyiv': 'UA',
  'Europe/Sofia': 'BG',
  'Europe/Athens': 'GR',
  'Europe/Istanbul': 'TR',
  'Europe/Minsk': 'BY',

  // Central Europe
  'Europe/Berlin': 'DE',
  'Europe/Vienna': 'AT',
  'Europe/Zurich': 'CH',
  'Europe/Warsaw': 'PL',
  'Europe/Prague': 'CZ',
  'Europe/Bratislava': 'SK',
  'Europe/Budapest': 'HU',
  'Europe/Zagreb': 'HR',
  'Europe/Ljubljana': 'SI',
  'Europe/Belgrade': 'RS',
  'Europe/Sarajevo': 'BA',

  // Western & Northern Europe
  'Europe/London': 'GB',
  'Europe/Dublin': 'IE',
  'Europe/Paris': 'FR',
  'Europe/Brussels': 'BE',
  'Europe/Amsterdam': 'NL',
  'Europe/Luxembourg': 'LU',
  'Europe/Rome': 'IT',
  'Europe/Madrid': 'ES',
  'Europe/Lisbon': 'PT',
  'Europe/Copenhagen': 'DK',
  'Europe/Stockholm': 'SE',
  'Europe/Oslo': 'NO',
  'Europe/Helsinki': 'FI',
  'Europe/Vilnius': 'LT',
  'Europe/Riga': 'LV',
  'Europe/Tallinn': 'EE',
  'Europe/Valletta': 'MT',
  'Atlantic/Reykjavik': 'IS',

  // Americas - United States
  'America/New_York': 'US',
  'America/Detroit': 'US',
  'America/Kentucky/Louisville': 'US',
  'America/Kentucky/Monticello': 'US',
  'America/Indiana/Indianapolis': 'US',
  'America/Chicago': 'US',
  'America/Indiana/Knox': 'US',
  'America/Menominee': 'US',
  'America/North_Dakota/Center': 'US',
  'America/North_Dakota/New_Salem': 'US',
  'America/North_Dakota/Beulah': 'US',
  'America/Denver': 'US',
  'America/Boise': 'US',
  'America/Phoenix': 'US',
  'America/Los_Angeles': 'US',
  'America/Anchorage': 'US',
  'America/Juneau': 'US',
  'America/Sitka': 'US',
  'America/Metlakatla': 'US',
  'America/Yakutat': 'US',
  'America/Nome': 'US',
  'America/Adak': 'US',
  'Pacific/Honolulu': 'US',

  // Americas - Canada
  'America/Toronto': 'CA',
  'America/Montreal': 'CA',
  'America/Vancouver': 'CA',
  'America/Edmonton': 'CA',
  'America/Calgary': 'CA',
  'America/Winnipeg': 'CA',
  'America/Halifax': 'CA',
  'America/St_Johns': 'CA',

  // Americas - Latin America
  'America/Mexico_City': 'MX',
  'America/Cancun': 'MX',
  'America/Monterrey': 'MX',
  'America/Tijuana': 'MX',
  'America/Bogota': 'CO',
  'America/Sao_Paulo': 'BR',
  'America/Buenos_Aires': 'AR',
  'America/Argentina/Buenos_Aires': 'AR',
  'America/Santiago': 'CL',
  'America/Lima': 'PE',

  // Asia / Pacific
  'Asia/Tokyo': 'JP',
  'Asia/Seoul': 'KR',
  'Asia/Singapore': 'SG',
  'Asia/Hong_Kong': 'HK',
  'Asia/Taipei': 'TW',
  'Asia/Jerusalem': 'IL',
  'Australia/Sydney': 'AU',
  'Australia/Melbourne': 'AU',
  'Australia/Brisbane': 'AU',
  'Australia/Perth': 'AU',
  'Australia/Adelaide': 'AU',
  'Pacific/Auckland': 'NZ',
};

/**
 * Resolves an ISO 2-letter country code from an IANA timezone string.
 */
export function getCountryFromTimezone(timezone?: string | null): string | null {
  if (!timezone || typeof timezone !== 'string') {
    return null;
  }
  const clean = timezone.trim();
  return TIMEZONE_COUNTRY_MAP[clean] || null;
}

/**
 * Resolves the client country through a deterministic priority cascade:
 *
 * In Development (`process.env.NODE_ENV !== 'production'`):
 *   1. Explicit URL Query Override (`?country=XX`)
 *   2. Explicit Environment Override (`process.env.DEV_COUNTRY`)
 *   3. Stored Dev Override Cookie (`bookarium-dev-country-override`)
 *   4. System Timezone Inference (`Europe/Bucharest` -> `RO`)
 *   5. Fallback (`US`)
 *
 * In Production (`process.env.NODE_ENV === 'production'`):
 *   1. Edge IP Headers (`x-vercel-ip-country`, `cf-ipcountry`, `request.geo?.country`)
 *   2. Downstream Proxy Stamp Header (`x-bookarium-country`)
 *   3. Session Cookie (`bookarium-geo-country`)
 *   4. Fallback (`US`)
 */
export function resolveClientCountry(
  request: NextRequest,
  searchParams?: URLSearchParams
): string {
  const isDev = process.env.NODE_ENV === 'development';

  // --- Tier 1: Development URL Query Override (?country=XX) ---
  if (isDev) {
    let queryCountry: string | null = null;
    if (searchParams) {
      queryCountry = searchParams.get('country');
    } else if (request.nextUrl?.searchParams) {
      queryCountry = request.nextUrl.searchParams.get('country');
    } else if (request.url) {
      try {
        queryCountry = new URL(request.url).searchParams.get('country');
      } catch {
        queryCountry = null;
      }
    }

    if (queryCountry && queryCountry.trim()) {
      const cleanOverride = queryCountry.trim().toUpperCase().slice(0, 2);
      if (/^[A-Z]{2}$/.test(cleanOverride)) {
        return cleanOverride;
      }
    }
  }

  // --- Tier 2: Development Environment Variable Override (DEV_COUNTRY) ---
  if (isDev && process.env.DEV_COUNTRY && process.env.DEV_COUNTRY.trim()) {
    const envCountry = process.env.DEV_COUNTRY.trim().toUpperCase().slice(0, 2);
    if (/^[A-Z]{2}$/.test(envCountry)) {
      return envCountry;
    }
  }

  // --- Tier 3: Platform Edge IP Country Headers (Vercel, Cloudflare, Next.js Edge geo) ---
  const edgeCountry =
    request.headers.get('x-vercel-ip-country')?.trim().toUpperCase().slice(0, 2) ||
    request.headers.get('cf-ipcountry')?.trim().toUpperCase().slice(0, 2) ||
    ((request as unknown as { geo?: { country?: string } }).geo?.country?.trim().toUpperCase().slice(0, 2));

  if (edgeCountry && /^[A-Z]{2}$/.test(edgeCountry)) {
    return edgeCountry;
  }

  // --- Tier 4: Development Stored Query Override Cookie ---
  if (isDev) {
    const devOverrideCookie = request.cookies.get(DEV_OVERRIDE_COOKIE_NAME)?.value?.trim().toUpperCase().slice(0, 2);
    if (devOverrideCookie && /^[A-Z]{2}$/.test(devOverrideCookie)) {
      return devOverrideCookie;
    }
  }

  // --- Tier 5: Development System Timezone Inference ---
  // In development, the developer's physical timezone takes precedence over stale session cookies
  if (isDev) {
    try {
      const systemTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const tzCountry = getCountryFromTimezone(systemTimezone);
      if (tzCountry) {
        return tzCountry;
      }
    } catch {
      // Gracefully continue to downstream tiers
    }
  }

  // --- Tier 6: Downstream Proxy Stamp Header (Production & Internal Route Handoff) ---
  const proxyHeader = request.headers.get('x-bookarium-country')?.trim().toUpperCase().slice(0, 2);
  if (proxyHeader && /^[A-Z]{2}$/.test(proxyHeader)) {
    return proxyHeader;
  }

  // --- Tier 7: Session Cookie (Active/Stored Client Jurisdiction) ---
  const cookieCountry = request.cookies.get(GEO_COOKIE_NAME)?.value?.trim().toUpperCase().slice(0, 2);
  if (cookieCountry && /^[A-Z]{2}$/.test(cookieCountry)) {
    return cookieCountry;
  }

  // --- Tier 8: Safe Default Fallback ---
  return 'US';
}
