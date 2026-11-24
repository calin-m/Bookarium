import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  normalizeScholarHandle,
  hasCachedScholarProfile,
  setServerProfileCache,
  clearServerProfileCache,
  fetchPublicScholarProfileSummary,
  fetchPublicScholarCardPayload,
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
        bio_book_id: null,
        bio_book_title: null,
        bio_book_author: null,
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

  it('anchors serverProfileCache on globalThis for warm serverless reuse', async () => {
    setServerProfileCache('persisted_scholar', { status: 'private_or_missing' });
    const globalCache = (
      globalThis as typeof globalThis & { __bookariumServerProfileCache?: Map<string, unknown> }
    ).__bookariumServerProfileCache;
    expect(globalCache?.has('persisted_scholar')).toBe(true);
    clearServerProfileCache();
    expect(globalCache?.size).toBe(0);
  });

  it('preserves attributed highlight metadata on public scholar profile summaries', async () => {
    vi.spyOn(supabaseProviderModule, 'isSupabaseConfigured').mockReturnValue(true);

    const maybeSingle = vi.fn().mockResolvedValueOnce({
      data: {
        display_name: 'Mary Shelley',
        username: 'mary_shelley',
        bio: 'Beware; for I am fearless.',
        bio_book_id: 84,
        bio_book_title: 'Frankenstein',
        bio_book_author: 'Mary Shelley',
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

    const res = await fetchPublicScholarProfileSummary('mary_shelley');
    expect(res).toEqual({
      status: 'public',
      profile: {
        display_name: 'Mary Shelley',
        username: 'mary_shelley',
        bio: 'Beware; for I am fearless.',
        bio_book_id: 84,
        bio_book_title: 'Frankenstein',
        bio_book_author: 'Mary Shelley',
        is_public: true,
      },
    });
  });

  describe('fetchPublicScholarCardPayload', () => {
    it('collapses malformed handles to private_or_missing and returns unavailable when Supabase is disabled', async () => {
      expect(await fetchPublicScholarCardPayload('invalid handle!')).toEqual({
        status: 'private_or_missing',
      });
      vi.spyOn(supabaseProviderModule, 'isSupabaseConfigured').mockReturnValue(false);
      expect(await fetchPublicScholarCardPayload('jane_austen')).toEqual({
        status: 'unavailable',
      });
    });

    it('resolves server-verified identity, attribution, and privacy-gated summary counts for public scholars', async () => {
      vi.spyOn(supabaseProviderModule, 'isSupabaseConfigured').mockReturnValue(true);

      const profileRow = {
        id: 'scholar-uuid-1',
        display_name: 'Jane Austen',
        username: 'Jane_Austen',
        bio: 'Vanity and pride are different things.',
        bio_book_id: 1342,
        bio_book_title: 'Pride and Prejudice',
        bio_book_author: 'Jane Austen',
        is_public: true,
        show_streak: true,
        show_challenge: true,
        show_bookshelves: true,
        show_saved_books: true,
        show_custom_shelves: false,
        created_at: '2025-06-15T00:00:00.000Z',
      };

      const fromMock = vi.fn((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              ilike: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  abortSignal: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: profileRow, error: null }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'user_accolades') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  abortSignal: vi.fn().mockResolvedValue({
                    data: [{ accolade_id: 'night_owl' }, { accolade_id: 'polymath' }],
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'user_reading_habits') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                abortSignal: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      annual_goal: 20,
                      active_dates: [],
                      completed_books_count: 8,
                    },
                  }),
                }),
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              abortSignal: vi.fn().mockResolvedValue({
                data: [
                  { id: 's1', is_default: true, is_public: true },
                  { id: 's2', is_default: false, is_public: true },
                ],
              }),
            }),
          }),
        };
      });

      vi.spyOn(supabaseClientModule, 'createClient').mockReturnValue({
        from: fromMock,
      } as unknown as MockSupabaseClient);

      const res = await fetchPublicScholarCardPayload('jane_austen');
      expect(res).toEqual({
        status: 'public',
        card: {
          username: 'Jane_Austen',
          displayName: 'Jane Austen',
          initials: 'JA',
          memberSince: 'June 2025',
          bio: 'Vanity and pride are different things.',
          bioBookTitle: 'Pride and Prejudice',
          bioBookAuthor: 'Jane Austen',
          statsPills: ['0d Streak', '8/20 Goal', '2 Bookplates', '1 Shelf'],
        },
      });
    });
  });
});
