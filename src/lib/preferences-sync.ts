import { READER_FONT_CONFIG, resolveDefaultReaderFontSize } from '@/config/reader-config';
import { useThemeStore, type AppTheme } from '@/stores/useThemeStore';
import {
  useReaderStore,
  type ReaderFontFamily,
  type ReaderReadingMode,
  type ReaderColumnWidth,
} from '@/stores/useReaderStore';
import {
  usePreferencesStore,
  type ScholarPreferencesSnapshot,
} from '@/stores/usePreferencesStore';
import { useAnnotationStore } from '@/stores/useAnnotationStore';
import { useAuthStore } from '@/stores/useAuthStore';
import type { Json, Profile } from '@/types/database.types';

export type { ScholarPreferencesSnapshot };

export type ReaderAppearanceSnapshot = Pick<
  ScholarPreferencesSnapshot,
  | 'theme'
  | 'fontFamily'
  | 'fontSize'
  | 'lineHeight'
  | 'brightness'
  | 'readingMode'
  | 'columnWidth'
>;

export interface ProfilePreferencesPayload {
  active: ScholarPreferencesSnapshot;
  customDefaults: ScholarPreferencesSnapshot | null;
  updatedAt: string;
}

export const FACTORY_PREFERENCES: Readonly<ScholarPreferencesSnapshot> = Object.freeze({
  theme: 'light',
  stickyScrollEnabled: true,
  fontFamily: 'serif',
  fontSize: READER_FONT_CONFIG.DEFAULT_SIZE,
  lineHeight: READER_FONT_CONFIG.DEFAULT_LINE_HEIGHT,
  brightness: READER_FONT_CONFIG.DEFAULT_BRIGHTNESS,
  readingMode: 'paginated',
  columnWidth: 'wide',
  spoilerShieldEnabled: true,
  speechRate: 1.0,
  speechVoiceURI: null,
  speechAutoPageAdvance: true,
  speechHighlightEnabled: true,
});

/**
 * Resolves the factory preferences snapshot with device-adaptive default font size
 * (`15px` on phones `< 640px`, `17px` on tablets `640px–1023px`, `18px` on desktop `>= 1024px`).
 */
export function getFactoryPreferences(viewportWidth?: number): ScholarPreferencesSnapshot {
  return {
    ...FACTORY_PREFERENCES,
    fontSize: resolveDefaultReaderFontSize(viewportWidth),
  };
}

function isValidTheme(val: unknown): val is AppTheme {
  return val === 'light' || val === 'sepia' || val === 'dark';
}

function isValidFontFamily(val: unknown): val is ReaderFontFamily {
  return val === 'serif' || val === 'sans' || val === 'mono';
}

function isValidReadingMode(val: unknown): val is ReaderReadingMode {
  return val === 'paginated' || val === 'scroll';
}

function isValidColumnWidth(val: unknown): val is ReaderColumnWidth {
  return val === 'narrow' || val === 'normal' || val === 'wide';
}

function clampNumber(val: unknown, min: number, max: number, fallback: number): number {
  if (typeof val !== 'number' || Number.isNaN(val)) return fallback;
  return Math.min(Math.max(val, min), max);
}

/**
 * Normalizes and validates an untrusted or partial preferences object against a fallback snapshot.
 */
export function sanitizePreferencesSnapshot(
  raw: unknown,
  fallback: ScholarPreferencesSnapshot = FACTORY_PREFERENCES
): ScholarPreferencesSnapshot {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...fallback };
  }
  const rec = raw as Record<string, unknown>;
  const rawLineHeight = clampNumber(rec.lineHeight, 1.2, 2.6, fallback.lineHeight);

  return {
    theme: isValidTheme(rec.theme) ? rec.theme : fallback.theme,
    stickyScrollEnabled:
      typeof rec.stickyScrollEnabled === 'boolean'
        ? rec.stickyScrollEnabled
        : fallback.stickyScrollEnabled,
    fontFamily: isValidFontFamily(rec.fontFamily) ? rec.fontFamily : fallback.fontFamily,
    fontSize: Math.round(
      clampNumber(
        rec.fontSize,
        READER_FONT_CONFIG.MIN_SIZE,
        READER_FONT_CONFIG.MAX_SIZE,
        fallback.fontSize
      )
    ),
    lineHeight: Number(rawLineHeight.toFixed(2)),
    brightness: Math.round(
      clampNumber(
        rec.brightness,
        READER_FONT_CONFIG.MIN_BRIGHTNESS,
        READER_FONT_CONFIG.MAX_BRIGHTNESS,
        fallback.brightness
      )
    ),
    readingMode: isValidReadingMode(rec.readingMode) ? rec.readingMode : fallback.readingMode,
    columnWidth: isValidColumnWidth(rec.columnWidth) ? rec.columnWidth : fallback.columnWidth,
    spoilerShieldEnabled:
      typeof rec.spoilerShieldEnabled === 'boolean'
        ? rec.spoilerShieldEnabled
        : fallback.spoilerShieldEnabled,
    speechRate: Number(clampNumber(rec.speechRate, 0.5, 2.5, fallback.speechRate).toFixed(2)),
    speechVoiceURI:
      typeof rec.speechVoiceURI === 'string' && rec.speechVoiceURI.trim().length > 0
        ? rec.speechVoiceURI
        : null,
    speechAutoPageAdvance:
      typeof rec.speechAutoPageAdvance === 'boolean'
        ? rec.speechAutoPageAdvance
        : fallback.speechAutoPageAdvance,
    speechHighlightEnabled:
      typeof rec.speechHighlightEnabled === 'boolean'
        ? rec.speechHighlightEnabled
        : fallback.speechHighlightEnabled,
  };
}

/**
 * Compares two full ScholarPreferencesSnapshot objects for value equality.
 */
export function arePreferencesEqual(
  a: ScholarPreferencesSnapshot | null | undefined,
  b: ScholarPreferencesSnapshot | null | undefined
): boolean {
  if (!a || !b) return false;
  return (
    a.theme === b.theme &&
    a.stickyScrollEnabled === b.stickyScrollEnabled &&
    a.fontFamily === b.fontFamily &&
    a.fontSize === b.fontSize &&
    Math.abs(a.lineHeight - b.lineHeight) < 0.005 &&
    a.brightness === b.brightness &&
    a.readingMode === b.readingMode &&
    a.columnWidth === b.columnWidth &&
    a.spoilerShieldEnabled === b.spoilerShieldEnabled &&
    Math.abs(a.speechRate - b.speechRate) < 0.005 &&
    (a.speechVoiceURI ?? null) === (b.speechVoiceURI ?? null) &&
    a.speechAutoPageAdvance === b.speechAutoPageAdvance &&
    a.speechHighlightEnabled === b.speechHighlightEnabled
  );
}

/**
 * Compares two reader appearance subsets (used in the Focus Reader `ReaderControls` drawer).
 */
export function areReaderAppearancePreferencesEqual(
  a: ReaderAppearanceSnapshot | null | undefined,
  b: ReaderAppearanceSnapshot | null | undefined
): boolean {
  if (!a || !b) return false;
  return (
    a.theme === b.theme &&
    a.fontFamily === b.fontFamily &&
    a.fontSize === b.fontSize &&
    Math.abs(a.lineHeight - b.lineHeight) < 0.005 &&
    a.brightness === b.brightness &&
    a.readingMode === b.readingMode &&
    a.columnWidth === b.columnWidth
  );
}

/**
 * Reads the current live preferences across all 4 client stores.
 */
export function getActivePreferencesSnapshot(): ScholarPreferencesSnapshot {
  const themeState = useThemeStore.getState();
  const readerState = useReaderStore.getState();
  const prefState = usePreferencesStore.getState();
  const annotState = useAnnotationStore.getState();

  return sanitizePreferencesSnapshot({
    theme: themeState.theme || readerState.theme || FACTORY_PREFERENCES.theme,
    stickyScrollEnabled: prefState.stickyScrollEnabled,
    fontFamily: readerState.fontFamily,
    fontSize: !readerState.isFontSizeCustomized
      ? resolveDefaultReaderFontSize()
      : readerState.fontSize,
    lineHeight: readerState.lineHeight,
    brightness: readerState.brightness,
    readingMode: readerState.readingMode,
    columnWidth: readerState.columnWidth,
    spoilerShieldEnabled: annotState.spoilerShieldEnabled,
    speechRate: prefState.speechRate,
    speechVoiceURI: prefState.speechVoiceURI,
    speechAutoPageAdvance: prefState.speechAutoPageAdvance,
    speechHighlightEnabled: prefState.speechHighlightEnabled,
  });
}

let preferencesSyncDebounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Cancels any pending debounced preferences cloud sync (called on signOut or account deletion).
 */
export function cancelPendingPreferencesCloudSync(): void {
  if (preferencesSyncDebounceTimer !== null) {
    clearTimeout(preferencesSyncDebounceTimer);
    preferencesSyncDebounceTimer = null;
  }
}

/**
 * Constructs the Supabase `public.profiles` update payload for current preferences and custom preset.
 */
export function buildProfilePreferencesPayload(
  updatedAtOverride?: string
): {
  preferred_theme: string;
  font_size: number;
  preferences: Json;
} {
  const active = getActivePreferencesSnapshot();
  const { customDefaults, preferencesUpdatedAt } = usePreferencesStore.getState();
  const updatedAt = updatedAtOverride || preferencesUpdatedAt || new Date().toISOString();

  const payload: ProfilePreferencesPayload = {
    active,
    customDefaults: customDefaults ? sanitizePreferencesSnapshot(customDefaults) : null,
    updatedAt,
  };

  return {
    preferred_theme: active.theme,
    font_size: active.fontSize,
    preferences: payload as unknown as Json,
  };
}

/**
 * Records a local modification timestamp and schedules a debounced sync to `public.profiles` when signed in.
 */
export function schedulePreferencesCloudSync(delayMs = 500): void {
  const nowIso = new Date().toISOString();
  usePreferencesStore.getState().setPreferencesUpdatedAt(nowIso);

  const user = useAuthStore.getState().user;
  if (!user) return;

  cancelPendingPreferencesCloudSync();

  if (delayMs <= 0) {
    const updatePayload = buildProfilePreferencesPayload(nowIso);
    void useAuthStore.getState().updateProfile(updatePayload)?.catch?.(() => {});
    return;
  }

  preferencesSyncDebounceTimer = setTimeout(() => {
    preferencesSyncDebounceTimer = null;
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) return;
    const updatePayload = buildProfilePreferencesPayload();
    void useAuthStore.getState().updateProfile(updatePayload)?.catch?.(() => {});
  }, delayMs);
}

/**
 * Atomically applies a partial or complete preferences snapshot across all stores.
 */
export function applyPreferencesSnapshot(
  partialSnapshot: Partial<ScholarPreferencesSnapshot>,
  options: { syncCloud?: boolean; syncDelayMs?: number } = {}
): ScholarPreferencesSnapshot {
  const current = getActivePreferencesSnapshot();
  const next = sanitizePreferencesSnapshot({ ...current, ...partialSnapshot }, current);

  // 1. Theme Store & Reader Store Theme
  useReaderStore.getState().setTheme(next.theme);
  useReaderStore.getState().setFontFamily(next.fontFamily);
  useReaderStore.getState().setFontSize(next.fontSize);
  useReaderStore.getState().setLineHeight(next.lineHeight);
  useReaderStore.getState().setBrightness(next.brightness);
  useReaderStore.getState().setReadingMode(next.readingMode);
  useReaderStore.getState().setColumnWidth(next.columnWidth);

  // 2. Preferences Store
  const prefStore = usePreferencesStore.getState();
  prefStore.setStickyScrollEnabled(next.stickyScrollEnabled);
  prefStore.setSpeechRate(next.speechRate);
  prefStore.setSpeechVoiceURI(next.speechVoiceURI);
  prefStore.setSpeechAutoPageAdvance(next.speechAutoPageAdvance);
  prefStore.setSpeechHighlightEnabled(next.speechHighlightEnabled);

  // 3. Annotation Store (Symposium Spoiler Shield)
  useAnnotationStore.getState().setSpoilerShieldEnabled(next.spoilerShieldEnabled);

  if (options.syncCloud !== false) {
    schedulePreferencesCloudSync(options.syncDelayMs);
  }

  return next;
}

/**
 * Saves the current active settings across all stores as the scholar's personal default preset (`customDefaults`).
 */
export function saveCurrentAsCustomDefaults(
  options: { syncCloud?: boolean; syncDelayMs?: number } = {}
): ScholarPreferencesSnapshot {
  const snapshot = getActivePreferencesSnapshot();
  usePreferencesStore.getState().setCustomDefaults(snapshot);
  if (options.syncCloud !== false) {
    schedulePreferencesCloudSync(options.syncDelayMs ?? 0);
  }
  return snapshot;
}

/**
 * Reverts all active settings to the scholar's saved `customDefaults` preset (if present).
 */
export function revertToCustomDefaults(
  options: { syncCloud?: boolean; syncDelayMs?: number } = {}
): ScholarPreferencesSnapshot | null {
  const { customDefaults } = usePreferencesStore.getState();
  if (!customDefaults) return null;
  return applyPreferencesSnapshot(customDefaults, {
    syncCloud: options.syncCloud ?? true,
    syncDelayMs: options.syncDelayMs ?? 0,
  });
}

/**
 * Resets all active settings back to Bookarium's factory defaults (`getFactoryPreferences()`).
 */
export function resetAllPreferencesToFactoryDefaults(
  options: {
    clearCustomPreset?: boolean;
    syncCloud?: boolean;
    syncDelayMs?: number;
  } = {}
): ScholarPreferencesSnapshot {
  if (options.clearCustomPreset) {
    usePreferencesStore.getState().setCustomDefaults(null);
  }
  const factoryTarget = getFactoryPreferences();
  const applied = applyPreferencesSnapshot(factoryTarget, {
    syncCloud: options.syncCloud ?? true,
    syncDelayMs: options.syncDelayMs ?? 0,
  });
  useReaderStore.setState({ isFontSizeCustomized: false });
  if (options.clearCustomPreset && options.syncCloud === false) {
    usePreferencesStore.getState().setPreferencesUpdatedAt(null);
  }
  return applied;
}

/**
 * Resets only the Focus Reader appearance & layout settings (`theme`, `fontFamily`, `fontSize`,
 * `lineHeight`, `brightness`, `readingMode`, `columnWidth`) to either the user's saved preset or factory defaults.
 */
export function resetReaderAppearanceToDefaults(
  mode: 'custom' | 'factory',
  options: { syncCloud?: boolean; syncDelayMs?: number } = {}
): ScholarPreferencesSnapshot {
  const { customDefaults } = usePreferencesStore.getState();
  const targetSource =
    mode === 'custom' && customDefaults ? customDefaults : getFactoryPreferences();

  const applied = applyPreferencesSnapshot(
    {
      theme: targetSource.theme,
      fontFamily: targetSource.fontFamily,
      fontSize: targetSource.fontSize,
      lineHeight: targetSource.lineHeight,
      brightness: targetSource.brightness,
      readingMode: targetSource.readingMode,
      columnWidth: targetSource.columnWidth,
    },
    {
      syncCloud: options.syncCloud ?? true,
      syncDelayMs: options.syncDelayMs ?? 0,
    }
  );
  if (mode === 'factory') {
    useReaderStore.setState({ isFontSizeCustomized: false });
  }
  return applied;
}

/**
 * Reconciles `profile.preferences` (and fallback `preferred_theme` / `font_size`) from Supabase
 * against local preference stores using Last-Write-Wins (LWW) timestamps.
 */
export function reconcileCloudPreferencesWithLocal(
  profile: Profile | null | undefined
): void {
  if (!profile) return;

  // Self-heal any un-synced local Navbar theme change where useThemeStore diverged from useReaderStore
  const globalTheme = useThemeStore.getState().theme;
  const readerTheme = useReaderStore.getState().theme;
  if (isValidTheme(globalTheme) && globalTheme !== readerTheme) {
    useReaderStore.getState().setTheme(globalTheme);
    schedulePreferencesCloudSync(0);
    return;
  }

  const localUpdatedAt = usePreferencesStore.getState().preferencesUpdatedAt;
  const localTime = localUpdatedAt ? new Date(localUpdatedAt).getTime() : 0;

  const rawPrefs = profile.preferences;
  const hasStructuredCloudPrefs =
    rawPrefs !== null &&
    typeof rawPrefs === 'object' &&
    !Array.isArray(rawPrefs) &&
    ('active' in rawPrefs || 'customDefaults' in rawPrefs || 'updatedAt' in rawPrefs);

  if (hasStructuredCloudPrefs) {
    const cloudRecord = rawPrefs as Record<string, unknown>;
    const remoteUpdatedAt =
      typeof cloudRecord.updatedAt === 'string'
        ? cloudRecord.updatedAt
        : profile.updated_at;
    const remoteTime = remoteUpdatedAt ? new Date(remoteUpdatedAt).getTime() : 0;

    if (!localUpdatedAt || remoteTime >= localTime) {
      if (cloudRecord.active && typeof cloudRecord.active === 'object') {
        const sanitizedActive = sanitizePreferencesSnapshot(
          cloudRecord.active,
          getActivePreferencesSnapshot()
        );
        applyPreferencesSnapshot(sanitizedActive, { syncCloud: false });
      }
      if ('customDefaults' in cloudRecord) {
        const remoteCustom = cloudRecord.customDefaults
          ? sanitizePreferencesSnapshot(cloudRecord.customDefaults, FACTORY_PREFERENCES)
          : null;
        usePreferencesStore.getState().setCustomDefaults(remoteCustom);
      }
      if (remoteUpdatedAt) {
        usePreferencesStore.getState().setPreferencesUpdatedAt(remoteUpdatedAt);
      }
    } else {
      // Local preferences were modified more recently (e.g. while offline) -> push to cloud
      schedulePreferencesCloudSync(0);
    }
    return;
  }

  // Fallback for legacy profile rows that only have preferred_theme or font_size populated
  if (!localUpdatedAt) {
    if (isValidTheme(globalTheme) && globalTheme !== 'light' && profile.preferred_theme === 'light') {
      useReaderStore.getState().setTheme(globalTheme);
      schedulePreferencesCloudSync(0);
      return;
    }
    const partialLegacy: Partial<ScholarPreferencesSnapshot> = {};
    if (isValidTheme(profile.preferred_theme)) {
      partialLegacy.theme = profile.preferred_theme;
    }
    if (typeof profile.font_size === 'number' && !Number.isNaN(profile.font_size)) {
      partialLegacy.fontSize = profile.font_size;
    }
    if (Object.keys(partialLegacy).length > 0) {
      applyPreferencesSnapshot(partialLegacy, { syncCloud: false });
      if (profile.updated_at) {
        usePreferencesStore.getState().setPreferencesUpdatedAt(profile.updated_at);
      }
    }
  } else {
    // Seed structured preferences to cloud for the first time
    schedulePreferencesCloudSync(0);
  }
}
