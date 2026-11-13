import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  normalizeScholarHandle,
  hasCachedScholarProfile,
  setServerProfileCache,
  clearServerProfileCache,
  fetchPublicScholarProfileSummary,
  MAX_PROFILE_CACHE_ENTRIES,
} from './profile-layout-utils';
import * as supabaseClientModule from '@/lib/supabase/client';
import * as supabaseProviderModule from '@/lib/catalog/supabase-provider';

type MockSupabaseClient = ReturnType<typeof supabaseClientModule.createClient>;

describe('profile-layout-utils', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearServerProfileCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearServerProfileCache();
  });

  it('normalizes URL-encoded scholar handles safely', () => {
    expect(normalizeScholarHandle('Jane_Austen%20')).toBe('jane_austen');
    expect(normalizeScholarHandle('%E0%A4%A')).toBe('%e0%a4%a');
  });

  it('collapses malformed handles directly to private_or_missing without querying Supabase', async () => {
    const configSpy = vi.spyOn(supabaseProviderModule, 'isSupabaseConfigured');
    const result = await fetchPublicScholarProfileSummary('invalid handle!');
    expect(result).toEqual({ status: 'private_or_missing' });
    expect(configSpy).not.toHaveBeenCalled();
  });

  it('returns unavailable when Supabase is not configured', async () => {
    vi.spyOn(supabaseProviderModule, 'isSupabaseConfigured').mockReturnValue(false);
    const result = await fetchPublicScholarProfileSummary('jane_austen');
    expect(result).toEqual({ status: 'unavailable' });
  });

  it('resolves public scholar profiles, caches hits, and evicts expired/LRU entries cleanly', async () => {
    vi.spyOn(supabaseProviderModule, 'isSupabaseConfigured').mockReturnValue(true);

    const maybeSingle = vi.fn().mockResolvedValueOnce({
      data: {
        display_name: 'Jane Austen',
        username: 'Jane_Austen',
        bio: 'Regency novelist.',
        is_public: true,
      },
      error: null,
    });
    const mockChain = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          ilike: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              abortSignal: vi.fn().mockReturnValue({ maybeSingle }),
            }),
          }),
        }),
      }),
    };
    vi.spyOn(supabaseClientModule, 'createClient').mockReturnValue(
      mockChain as unknown as MockSupabaseClient
    );

    const first = await fetchPublicScholarProfileSummary('jane_austen');
    expect(first).toEqual({
      status: 'public',
      profile: {
        display_name: 'Jane Austen',
        username: 'Jane_Austen',
        bio: 'Regency novelist.',
        is_public: true,
      },
    });
    expect(hasCachedScholarProfile('jane_austen')).toBe(true);

    // Repeat fetch should hit in-memory LRU without another Supabase query
    const second = await fetchPublicScholarProfileSummary('JANE_AUSTEN');
    expect(second).toEqual(first);
    expect(maybeSingle).toHaveBeenCalledTimes(1);

    // Expired TTL entry is invalidated cleanly
    setServerProfileCache('expired_user', { status: 'private_or_missing' }, -10);
    expect(hasCachedScholarProfile('expired_user')).toBe(false);

    // LRU cap evicts oldest entry when exceeding MAX_PROFILE_CACHE_ENTRIES
    for (let i = 0; i <= MAX_PROFILE_CACHE_ENTRIES; i++) {
      setServerProfileCache(`scholar_${i}`, {
        status: 'public',
        profile: { username: `scholar_${i}`, display_name: null, bio: null, is_public: true },
      });
    }
    expect(hasCachedScholarProfile('jane_austen')).toBe(false);
    expect(hasCachedScholarProfile(`scholar_${MAX_PROFILE_CACHE_ENTRIES}`)).toBe(true);
  });

  it('neutralizes SQL ILIKE underscore wildcard matches and caches hidden accounts uniformly', async () => {
    vi.spyOn(supabaseProviderModule, 'isSupabaseConfigured').mockReturnValue(true);

    const maybeSingle = vi.fn().mockResolvedValueOnce({
      data: {
        display_name: 'Jane X Austen',
        username: 'janexausten',
        bio: 'Different handle matched via SQL wildcard',
        is_public: true,
      },
      error: null,
    });
    vi.spyOn(supabaseClientModule, 'createClient').mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          ilike: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              abortSignal: vi.fn().mockReturnValue({ maybeSingle }),
            }),
          }),
        }),
      }),
    } as unknown as MockSupabaseClient);

    const result = await fetchPublicScholarProfileSummary('jane_austen');
    expect(result).toEqual({ status: 'private_or_missing' });
    expect(hasCachedScholarProfile('jane_austen')).toBe(true);
  });

  it('returns unavailable without caching when query errors or throws', async () => {
    vi.spyOn(supabaseProviderModule, 'isSupabaseConfigured').mockReturnValue(true);

    vi.spyOn(supabaseClientModule, 'createClient').mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          ilike: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              abortSignal: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValueOnce({ data: null, error: { message: 'DB error' } }),
              }),
            }),
          }),
        }),
      }),
    } as unknown as MockSupabaseClient);

    const errored = await fetchPublicScholarProfileSummary('mary_shelley');
    expect(errored).toEqual({ status: 'unavailable' });
    expect(hasCachedScholarProfile('mary_shelley')).toBe(false);

    vi.spyOn(supabaseClientModule, 'createClient').mockImplementation(() => {
      throw new Error('AbortError');
    });
    const thrown = await fetchPublicScholarProfileSummary('bram_stoker');
    expect(thrown).toEqual({ status: 'unavailable' });
  });
});
