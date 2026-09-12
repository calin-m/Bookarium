import { create } from 'zustand';
import { getJurisdictionRule, type JurisdictionRule, normalizeCountryCode } from '@/lib/copyright-engine';
import { getCountryFromTimezone } from '@/lib/country-resolver';
import { GEO_COOKIE_NAME } from '@/proxy';

export interface JurisdictionState {
  country: string;
  rule: JurisdictionRule;
  overrideCountry: string | null;
  setCountry: (country: string) => void;
  setOverrideCountry: (country: string | null) => void;
  resetOverride: () => void;
  getEffectiveCountry: () => string;
}

/**
 * Extracts a cookie value by name from document.cookie in browser environments.
 */
export function getCookieValue(cookieName: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${cookieName}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Resolves initial country synchronously:
 * 1. Client cookie stamped by edge middleware (`bookarium-geo-country`)
 * 2. Developer/client timezone inference via IANA timezone
 * 3. Defaults to 'US'
 */
export function resolveInitialCountry(): string {
  const cookieVal = getCookieValue(GEO_COOKIE_NAME);
  if (cookieVal) {
    return normalizeCountryCode(cookieVal);
  }

  if (
    process.env.NODE_ENV === 'development' &&
    typeof Intl !== 'undefined' &&
    typeof Intl.DateTimeFormat === 'function'
  ) {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const tzCountry = getCountryFromTimezone(tz);
      if (tzCountry) {
        return normalizeCountryCode(tzCountry);
      }
    } catch {
      // Gracefully fall back
    }
  }

  return 'US';
}

export const useJurisdictionStore = create<JurisdictionState>((set, get) => {
  const initialCountry = resolveInitialCountry();
  return {
    country: initialCountry,
    rule: getJurisdictionRule(initialCountry),
    overrideCountry: null,

    setCountry: (country: string) => {
      const normalized = normalizeCountryCode(country);
      set({
        country: normalized,
        rule: getJurisdictionRule(get().overrideCountry || normalized),
      });
    },

    setOverrideCountry: (override: string | null) => {
      const normalized = override ? normalizeCountryCode(override) : null;
      set({
        overrideCountry: normalized,
        rule: getJurisdictionRule(normalized || get().country),
      });
    },

    resetOverride: () => {
      set((state) => ({
        overrideCountry: null,
        rule: getJurisdictionRule(state.country),
      }));
    },

    getEffectiveCountry: () => {
      const { overrideCountry, country } = get();
      return overrideCountry || country;
    },
  };
});

/**
 * Convenience React hook for querying current jurisdictional rules.
 */
export function useJurisdiction() {
  const country = useJurisdictionStore((state) => state.getEffectiveCountry());
  const rule = useJurisdictionStore((state) => state.rule);
  const setOverrideCountry = useJurisdictionStore((state) => state.setOverrideCountry);
  const resetOverride = useJurisdictionStore((state) => state.resetOverride);

  return {
    country,
    rule,
    isUS: rule === 'US_PUBLIC_DOMAIN',
    isLife70: rule === 'LIFE_70',
    isLife100: rule === 'LIFE_100',
    isLife80: rule === 'LIFE_80',
    setOverrideCountry,
    resetOverride,
  };
}

/**
 * Synchronously initializes the jurisdiction store with a server-detected country.
 * Safe for execution during SSR and initial client hydration.
 */
export function initializeJurisdiction(country?: string | null): void {
  if (!country) return;
  const normalized = normalizeCountryCode(country);
  const current = useJurisdictionStore.getState();
  if (current.country !== normalized && !current.overrideCountry) {
    useJurisdictionStore.setState({
      country: normalized,
      rule: getJurisdictionRule(normalized),
    });
  }
}

