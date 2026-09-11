import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useJurisdictionStore, useJurisdiction, getCookieValue } from './useJurisdictionStore';
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
});

