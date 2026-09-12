import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBookCopyright } from './useBookCopyright';
import { useJurisdictionStore } from '@/stores/useJurisdictionStore';
import type { GutendexBook } from '@/types/book.types';

describe('useBookCopyright', () => {
  const janeAustenBook: GutendexBook = {
    id: 1342,
    title: 'Pride and Prejudice',
    authors: [{ name: 'Austen, Jane', birth_year: 1775, death_year: 1817 }],
    translators: [],
    subjects: ['Fiction'],
    bookshelves: [],
    languages: ['en'],
    copyright: false,
    media_type: 'Text',
    formats: {},
    download_count: 50000,
  };

  const agathaChristieBook: GutendexBook = {
    id: 9999,
    title: 'Death on the Nile',
    authors: [{ name: 'Christie, Agatha', birth_year: 1890, death_year: 1976 }],
    translators: [],
    subjects: ['Mystery'],
    bookshelves: [],
    languages: ['en'],
    copyright: false,
    media_type: 'Text',
    formats: {},
    download_count: 30000,
  };

  beforeEach(() => {
    useJurisdictionStore.setState({
      country: 'US',
      rule: 'US_PUBLIC_DOMAIN',
      overrideCountry: null,
    });
  });

  it('evaluates public domain works as allowed in US', () => {
    const { result } = renderHook(() => useBookCopyright(janeAustenBook));

    expect(result.current.isAllowed).toBe(true);
    expect(result.current.isRestricted).toBe(false);
    expect(result.current.country).toBe('US');
    expect(result.current.badgeLabel).toBe('CC0 / Free');
    expect(result.current.formatActionAriaLabel('Read')).toBe('Read "Pride and Prejudice"');
  });

  it('evaluates Agatha Christie as allowed in US but restricted in GB', () => {
    const { result } = renderHook(() => useBookCopyright(agathaChristieBook));

    expect(result.current.isAllowed).toBe(true);
    expect(result.current.isRestricted).toBe(false);

    act(() => {
      useJurisdictionStore.getState().setCountry('GB');
    });

    expect(result.current.country).toBe('GB');
    expect(result.current.isAllowed).toBe(false);
    expect(result.current.isRestricted).toBe(true);
    expect(result.current.badgeLabel).toBe('Protected (GB)');
    expect(result.current.reason).toContain('Deceased in 1976');
    expect(result.current.publicDomainYear).toBe(2047);
    expect(result.current.formatActionAriaLabel('Read')).toContain('Read is unavailable');
  });

  it('handles null book gracefully', () => {
    const { result } = renderHook(() => useBookCopyright(null));

    expect(result.current.isAllowed).toBe(false);
    expect(result.current.isRestricted).toBe(true);
    expect(result.current.badgeLabel).toBe('Protected (US)');
    expect(result.current.formatActionAriaLabel('Download')).toContain('Download is unavailable');
  });
});

