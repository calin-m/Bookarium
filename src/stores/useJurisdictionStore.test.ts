import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useJurisdictionStore,
  useJurisdiction,
  getCookieValue,
  resolveInitialCountry,
  initializeJurisdiction,
} from './useJurisdictionStore';
import { GEO_COOKIE_NAME } from '@/proxy';

describe('useJurisdictionStore', () => {
  beforeEach(() => {
    useJurisdictionStore.setState({
      country: 'US',
      rule: 'US_PUBLIC_DOMAIN',
      overrideCountry: null,
    });
    // Clear cookies
    if (typeof document !== 'undefined') {
      document.cookie = `${GEO_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    }
  });

  afterEach(() => {
    useJurisdictionStore.getState().resetOverride();
  });

  it('initializes with default US public domain rule', () => {
    const { result } = renderHook(() => useJurisdiction());
    expect(result.current.country).toBe('US');
    expect(result.current.rule).toBe('US_PUBLIC_DOMAIN');
    expect(result.current.isUS).toBe(true);
    expect(result.current.isLife70).toBe(false);
  });

  it('updates country and switches jurisdiction rule to Life + 70 for GB', () => {
    act(() => {
      useJurisdictionStore.getState().setCountry('GB');
    });

    const { result } = renderHook(() => useJurisdiction());
    expect(result.current.country).toBe('GB');
    expect(result.current.rule).toBe('LIFE_70');
    expect(result.current.isLife70).toBe(true);
    expect(result.current.isUS).toBe(false);
  });

  it('updates country and switches jurisdiction rule to Life + 100 for MX', () => {
    act(() => {
      useJurisdictionStore.getState().setCountry('MX');
    });

    const { result } = renderHook(() => useJurisdiction());
    expect(result.current.country).toBe('MX');
    expect(result.current.rule).toBe('LIFE_100');
    expect(result.current.isLife100).toBe(true);
  });

  it('supports developer country overrides', () => {
    const { result } = renderHook(() => useJurisdiction());

    act(() => {
      result.current.setOverrideCountry('DE');
    });

    expect(result.current.country).toBe('DE');
    expect(result.current.rule).toBe('LIFE_70');

    act(() => {
      result.current.resetOverride();
    });

    expect(result.current.country).toBe('US');
    expect(result.current.rule).toBe('US_PUBLIC_DOMAIN');
  });

  it('reads cookie value from document.cookie', () => {
    document.cookie = `${GEO_COOKIE_NAME}=FR; path=/;`;
    expect(getCookieValue(GEO_COOKIE_NAME)).toBe('FR');
  });

  it('resolves initial country from cookie when present', () => {
    document.cookie = `${GEO_COOKIE_NAME}=DE; path=/;`;
    expect(resolveInitialCountry()).toBe('DE');
  });

  it('resolves initial country from timezone when cookie is absent in development', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const originalDateTimeFormat = Intl.DateTimeFormat;
    try {
      // Mock timezone to Europe/Bucharest
      Intl.DateTimeFormat = (() => ({
        resolvedOptions: () => ({ timeZone: 'Europe/Bucharest' }),
      })) as unknown as typeof Intl.DateTimeFormat;

      expect(resolveInitialCountry()).toBe('RO');
    } finally {
      Intl.DateTimeFormat = originalDateTimeFormat;
      vi.unstubAllEnvs();
    }
  });

  it('falls back to US when cookie and timezone are unknown', () => {
    const originalDateTimeFormat = Intl.DateTimeFormat;
    try {
      Intl.DateTimeFormat = (() => ({
        resolvedOptions: () => ({ timeZone: 'Mars/Curiosity' }),
      })) as unknown as typeof Intl.DateTimeFormat;

      expect(resolveInitialCountry()).toBe('US');
    } finally {
      Intl.DateTimeFormat = originalDateTimeFormat;
    }
  });

  it('initializes jurisdiction safely via initializeJurisdiction', () => {
    initializeJurisdiction('MX');
    expect(useJurisdictionStore.getState().country).toBe('MX');
    expect(useJurisdictionStore.getState().rule).toBe('LIFE_100');

    // Does nothing if country is undefined or null
    initializeJurisdiction(null);
    expect(useJurisdictionStore.getState().country).toBe('MX');

    // Does not override active user override
    useJurisdictionStore.getState().setOverrideCountry('GB');
    initializeJurisdiction('FR');
    expect(useJurisdictionStore.getState().country).toBe('MX');
    expect(useJurisdictionStore.getState().getEffectiveCountry()).toBe('GB');
  });
});

