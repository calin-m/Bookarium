import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  FACTORY_PREFERENCES,
  type ScholarPreferencesSnapshot,
  sanitizePreferencesSnapshot,
  arePreferencesEqual,
  areReaderAppearancePreferencesEqual,
  getActivePreferencesSnapshot,
  applyPreferencesSnapshot,
  saveCurrentAsCustomDefaults,
  revertToCustomDefaults,
  resetAllPreferencesToFactoryDefaults,
  resetReaderAppearanceToDefaults,
  buildProfilePreferencesPayload,
  cancelPendingPreferencesCloudSync,
  reconcileCloudPreferencesWithLocal,
} from './preferences-sync';
import { useThemeStore } from '@/stores/useThemeStore';
import { useReaderStore } from '@/stores/useReaderStore';
import { usePreferencesStore } from '@/stores/usePreferencesStore';
import { useAnnotationStore } from '@/stores/useAnnotationStore';
import { useAuthStore } from '@/stores/useAuthStore';
import type { Profile } from '@/types/database.types';

describe('preferences-sync', () => {
  beforeEach(() => {
    cancelPendingPreferencesCloudSync();
    usePreferencesStore.getState().resetAllPreferencesStore();
    useThemeStore.getState().setTheme('light');
    useReaderStore.setState({
      fontSize: 18,
      lineHeight: 1.75,
      fontFamily: 'serif',
      theme: 'light',
      brightness: 100,
      readingMode: 'paginated',
      columnWidth: 'wide',
    });
    useAnnotationStore.getState().setSpoilerShieldEnabled(true);
    useAuthStore.setState({ user: null, profile: null });
  });

  describe('sanitizePreferencesSnapshot & equality helpers', () => {
    it('returns FACTORY_PREFERENCES clone when input is null, undefined, or non-object', () => {
      expect(sanitizePreferencesSnapshot(null)).toEqual(FACTORY_PREFERENCES);
      expect(sanitizePreferencesSnapshot(undefined)).toEqual(FACTORY_PREFERENCES);
      expect(sanitizePreferencesSnapshot([1, 2, 3])).toEqual(FACTORY_PREFERENCES);
    });

    it('clamps out-of-range numeric values and falls back on invalid enum strings', () => {
      const sanitized = sanitizePreferencesSnapshot({
        theme: 'invalid-theme',
        fontFamily: 'comic-sans',
        fontSize: 99,
        lineHeight: 0.5,
        brightness: 5,
        readingMode: 'diagonal',
        columnWidth: 'ultra-wide',
        speechRate: 9.0,
        speechVoiceURI: '   ',
      });

      expect(sanitized.theme).toBe('light');
      expect(sanitized.fontFamily).toBe('serif');
      expect(sanitized.fontSize).toBe(36);
      expect(sanitized.lineHeight).toBe(1.2);
      expect(sanitized.brightness).toBe(30);
      expect(sanitized.readingMode).toBe('paginated');
      expect(sanitized.columnWidth).toBe('wide');
      expect(sanitized.speechRate).toBe(2.5);
      expect(sanitized.speechVoiceURI).toBeNull();
    });

    it('compares full snapshots and reader appearance subsets accurately', () => {
      expect(arePreferencesEqual(null, FACTORY_PREFERENCES)).toBe(false);
      expect(arePreferencesEqual(FACTORY_PREFERENCES, { ...FACTORY_PREFERENCES })).toBe(true);
      expect(
        arePreferencesEqual(FACTORY_PREFERENCES, {
          ...FACTORY_PREFERENCES,
          fontSize: 22,
        })
      ).toBe(false);

      expect(areReaderAppearancePreferencesEqual(null, FACTORY_PREFERENCES)).toBe(false);
      const modifiedNonAppearance: ScholarPreferencesSnapshot = {
        ...FACTORY_PREFERENCES,
        speechRate: 1.5,
        stickyScrollEnabled: false,
      };
      expect(
        areReaderAppearancePreferencesEqual(FACTORY_PREFERENCES, modifiedNonAppearance)
      ).toBe(true);
      expect(
        areReaderAppearancePreferencesEqual(FACTORY_PREFERENCES, {
          ...FACTORY_PREFERENCES,
          readingMode: 'scroll',
        })
      ).toBe(false);
    });
  });

  describe('store coordination, custom default preset & factory reset', () => {
    it('applies snapshot across all 4 stores, saves custom defaults, reverts to custom defaults, and resets to factory', () => {
      expect(arePreferencesEqual(getActivePreferencesSnapshot(), FACTORY_PREFERENCES)).toBe(
        true
      );

      // Apply custom preferences
      applyPreferencesSnapshot(
        {
          theme: 'sepia',
          stickyScrollEnabled: false,
          fontFamily: 'mono',
          fontSize: 22,
          lineHeight: 2.0,
          brightness: 80,
          readingMode: 'scroll',
          columnWidth: 'narrow',
          spoilerShieldEnabled: false,
          speechRate: 1.25,
          speechVoiceURI: 'Google UK English Female',
          speechAutoPageAdvance: false,
          speechHighlightEnabled: false,
        },
        { syncCloud: false }
      );

      expect(useThemeStore.getState().theme).toBe('sepia');
      expect(useReaderStore.getState().theme).toBe('sepia');
      expect(useReaderStore.getState().fontFamily).toBe('mono');
      expect(useReaderStore.getState().fontSize).toBe(22);
      expect(useReaderStore.getState().lineHeight).toBe(2.0);
      expect(useReaderStore.getState().brightness).toBe(80);
      expect(useReaderStore.getState().readingMode).toBe('scroll');
      expect(useReaderStore.getState().columnWidth).toBe('narrow');
      expect(usePreferencesStore.getState().stickyScrollEnabled).toBe(false);
      expect(usePreferencesStore.getState().speechRate).toBe(1.25);
      expect(usePreferencesStore.getState().speechVoiceURI).toBe('Google UK English Female');
      expect(useAnnotationStore.getState().spoilerShieldEnabled).toBe(false);

      // Save as custom default preset
      const savedPreset = saveCurrentAsCustomDefaults({ syncCloud: false });
      expect(usePreferencesStore.getState().customDefaults).toEqual(savedPreset);

      // Temporarily tweak reader settings in a book
      applyPreferencesSnapshot(
        {
          theme: 'dark',
          fontSize: 28,
          brightness: 50,
          readingMode: 'paginated',
        },
        { syncCloud: false }
      );
      expect(useReaderStore.getState().fontSize).toBe(28);
      expect(arePreferencesEqual(getActivePreferencesSnapshot(), savedPreset)).toBe(false);

      // Revert reader appearance only to custom defaults
      resetReaderAppearanceToDefaults('custom', { syncCloud: false });
      expect(useReaderStore.getState().theme).toBe('sepia');
      expect(useReaderStore.getState().fontSize).toBe(22);
      expect(useReaderStore.getState().brightness).toBe(80);
      expect(useReaderStore.getState().readingMode).toBe('scroll');

      // Tweak sticky scroll & speech rate, then revert all to custom defaults
      applyPreferencesSnapshot({ stickyScrollEnabled: true, speechRate: 1.75 }, { syncCloud: false });
      const reverted = revertToCustomDefaults({ syncCloud: false });
      expect(reverted).toEqual(savedPreset);
      expect(usePreferencesStore.getState().stickyScrollEnabled).toBe(false);
      expect(usePreferencesStore.getState().speechRate).toBe(1.25);

      // Reset reader appearance to factory defaults
      resetReaderAppearanceToDefaults('factory', { syncCloud: false });
      expect(useReaderStore.getState().theme).toBe('light');
      expect(useReaderStore.getState().fontSize).toBe(18);
      expect(useReaderStore.getState().readingMode).toBe('paginated');

      // Reset all to factory defaults and clear custom preset
      resetAllPreferencesToFactoryDefaults({ clearCustomPreset: true, syncCloud: false });
      expect(getActivePreferencesSnapshot()).toEqual(FACTORY_PREFERENCES);
      expect(usePreferencesStore.getState().customDefaults).toBeNull();
      expect(revertToCustomDefaults({ syncCloud: false })).toBeNull();
    });
  });

  describe('cloud synchronization & LWW reconciliation', () => {
    it('schedules debounced cloud sync and pushes preferences payload to updateProfile', () => {
      vi.useFakeTimers();
      try {
        const mockUpdateProfile = vi.fn().mockResolvedValue({ error: null });
        useAuthStore.setState({
          user: { id: 'user-123' } as unknown as NonNullable<ReturnType<typeof useAuthStore.getState>['user']>,
          updateProfile: mockUpdateProfile,
        });

        applyPreferencesSnapshot({ theme: 'dark', fontSize: 20 }, { syncDelayMs: 300 });
        expect(mockUpdateProfile).not.toHaveBeenCalled();

        vi.advanceTimersByTime(300);
        expect(mockUpdateProfile).toHaveBeenCalledTimes(1);
        expect(mockUpdateProfile).toHaveBeenCalledWith(
          expect.objectContaining({
            preferred_theme: 'dark',
            font_size: 20,
            preferences: expect.objectContaining({
              active: expect.objectContaining({ theme: 'dark', fontSize: 20 }),
            }),
          })
        );
      } finally {
        vi.useRealTimers();
      }
    });

    it('hydrates local stores from structured cloud profile.preferences when remote is newer', () => {
      const remotePreset = {
        ...FACTORY_PREFERENCES,
        theme: 'sepia' as const,
        fontSize: 20,
        readingMode: 'scroll' as const,
        columnWidth: 'normal' as const,
      };
      const profile: Profile = {
        id: 'u1',
        display_name: 'Scholar',
        username: 'scholar',
        bio: null,
        is_public: false,
        show_streak: true,
        show_challenge: true,
        show_bookshelves: true,
        preferred_theme: 'sepia',
        font_size: 20,
        preferences: {
          active: remotePreset,
          customDefaults: remotePreset,
          updatedAt: '2026-10-31T20:00:00.000Z',
        },
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-10-31T20:00:00.000Z',
      };

      reconcileCloudPreferencesWithLocal(profile);

      expect(useThemeStore.getState().theme).toBe('sepia');
      expect(useReaderStore.getState().fontSize).toBe(20);
      expect(useReaderStore.getState().readingMode).toBe('scroll');
      expect(useReaderStore.getState().columnWidth).toBe('normal');
      expect(usePreferencesStore.getState().customDefaults).toEqual(remotePreset);
      expect(usePreferencesStore.getState().preferencesUpdatedAt).toBe(
        '2026-10-31T20:00:00.000Z'
      );
    });

    it('pushes newer local preferences to cloud when local preferencesUpdatedAt is newer than remote', () => {
      const mockUpdateProfile = vi.fn().mockResolvedValue({ error: null });
      useAuthStore.setState({
        user: { id: 'u1' } as unknown as NonNullable<ReturnType<typeof useAuthStore.getState>['user']>,
        updateProfile: mockUpdateProfile,
      });

      applyPreferencesSnapshot({ theme: 'dark', fontSize: 24 }, { syncCloud: false });
      usePreferencesStore.getState().setPreferencesUpdatedAt('2026-10-31T22:00:00.000Z');

      const staleRemoteProfile: Profile = {
        id: 'u1',
        display_name: 'Scholar',
        username: 'scholar',
        bio: null,
        is_public: false,
        show_streak: true,
        show_challenge: true,
        show_bookshelves: true,
        preferred_theme: 'light',
        font_size: 18,
        preferences: {
          active: FACTORY_PREFERENCES,
          customDefaults: null,
          updatedAt: '2026-10-31T10:00:00.000Z',
        },
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-10-31T10:00:00.000Z',
      };

      reconcileCloudPreferencesWithLocal(staleRemoteProfile);

      expect(useThemeStore.getState().theme).toBe('dark');
      expect(useReaderStore.getState().fontSize).toBe(24);
      expect(mockUpdateProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          preferred_theme: 'dark',
          font_size: 24,
        })
      );
    });

    it('falls back to legacy profile.preferred_theme and profile.font_size when structured preferences is empty', () => {
      const legacyProfile: Profile = {
        id: 'u1',
        display_name: 'Scholar',
        username: 'scholar',
        bio: null,
        is_public: false,
        show_streak: true,
        show_challenge: true,
        show_bookshelves: true,
        preferred_theme: 'sepia',
        font_size: 22,
        preferences: {},
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-10-31T10:00:00.000Z',
      };

      reconcileCloudPreferencesWithLocal(legacyProfile);
      expect(useThemeStore.getState().theme).toBe('sepia');
      expect(useReaderStore.getState().fontSize).toBe(22);
      expect(usePreferencesStore.getState().preferencesUpdatedAt).toBe('2026-10-31T10:00:00.000Z');

      const payload = buildProfilePreferencesPayload('2026-10-31T12:00:00.000Z');
      expect(payload.preferred_theme).toBe('sepia');
      expect(payload.font_size).toBe(22);
    });

    it('self-heals divergent useThemeStore vs useReaderStore theme and preserves local dark/sepia over default legacy light on refresh', () => {
      const mockUpdateProfile = vi.fn().mockResolvedValue({ error: null });
      useAuthStore.setState({
        user: { id: 'u1' } as unknown as NonNullable<ReturnType<typeof useAuthStore.getState>['user']>,
        updateProfile: mockUpdateProfile,
      });

      // 1. Divergent state: useThemeStore is dark while useReaderStore is light
      useThemeStore.getState().setTheme('dark');
      useReaderStore.setState({ theme: 'light' });

      const staleStructuredProfile: Profile = {
        id: 'u1',
        display_name: 'Scholar',
        username: 'scholar',
        bio: null,
        is_public: false,
        show_streak: true,
        show_challenge: true,
        show_bookshelves: true,
        preferred_theme: 'light',
        font_size: 18,
        preferences: {
          active: FACTORY_PREFERENCES,
          customDefaults: null,
          updatedAt: '2026-10-31T10:00:00.000Z',
        },
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-10-31T10:00:00.000Z',
      };

      reconcileCloudPreferencesWithLocal(staleStructuredProfile);
      expect(useThemeStore.getState().theme).toBe('dark');
      expect(useReaderStore.getState().theme).toBe('dark');
      expect(mockUpdateProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          preferred_theme: 'dark',
        })
      );

      // 2. Legacy profile with default preferred_theme: 'light' and null localUpdatedAt while local theme is sepia
      mockUpdateProfile.mockClear();
      usePreferencesStore.getState().setPreferencesUpdatedAt(null);
      useThemeStore.getState().setTheme('sepia');
      useReaderStore.setState({ theme: 'sepia' });

      const uninitializedLegacyProfile: Profile = {
        ...staleStructuredProfile,
        preferred_theme: 'light',
        preferences: {},
      };

      reconcileCloudPreferencesWithLocal(uninitializedLegacyProfile);
      expect(useThemeStore.getState().theme).toBe('sepia');
      expect(useReaderStore.getState().theme).toBe('sepia');
      expect(mockUpdateProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          preferred_theme: 'sepia',
        })
      );
    });
  });
});
