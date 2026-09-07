import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAccoladesStore, MAX_PINNED_ACCOLADES } from './useAccoladesStore';

const { mockSelect, mockEq, mockUpsert, mockUpdate } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockEq: vi.fn(),
  mockUpsert: vi.fn(),
  mockUpdate: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: mockSelect.mockReturnThis(),
      eq: mockEq,
      upsert: mockUpsert,
      update: mockUpdate.mockReturnThis(),
    })),
  })),
}));

describe('useAccoladesStore', () => {
  beforeEach(() => {
    localStorage.clear();
    mockSelect.mockReset();
    mockEq.mockReset();
    mockUpsert.mockReset();
    mockUpdate.mockReset();
    mockSelect.mockReturnThis();
    mockUpdate.mockReturnThis();
    mockEq.mockResolvedValue({ data: null, error: null });
    mockUpsert.mockResolvedValue({ data: null, error: null });
    useAccoladesStore.getState().resetAccolades();
  });

  it('initializes with clean default state', () => {
    const state = useAccoladesStore.getState();
    expect(state.unlockedAccolades).toEqual({});
    expect(state.pinnedAccoladeIds).toEqual([]);
    expect(state.pendingCelebrations).toEqual([]);
    expect(state.activeCelebration).toBeNull();
    expect(state.isSyncing).toBe(false);
  });

  it('evaluates and unlocks accolades when context meets criteria', () => {
    const { newlyUnlocked, progressMap } = useAccoladesStore.getState().evaluateAndUnlock({
      currentStreak: 7,
      longestStreak: 7,
    });

    expect(newlyUnlocked.some((a) => a.id === 'seven-day-sage')).toBe(true);
    expect(progressMap['seven-day-sage'].isUnlocked).toBe(true);
    expect(useAccoladesStore.getState().isUnlocked('seven-day-sage')).toBe(true);
    expect(useAccoladesStore.getState().activeCelebration?.id).toBe('seven-day-sage');
  });

  it('dismisses active celebration and shifts next pending celebration', () => {
    // Unlock multiple
    useAccoladesStore.getState().evaluateAndUnlock({
      currentStreak: 30,
      longestStreak: 30,
    });

    const state = useAccoladesStore.getState();
    expect(state.pendingCelebrations.length).toBeGreaterThanOrEqual(2); // 7-day and 30-day

    const firstId = state.activeCelebration?.id;
    useAccoladesStore.getState().dismissCelebration();

    const nextState = useAccoladesStore.getState();
    expect(nextState.activeCelebration?.id).not.toBe(firstId);
  });

  it('toggles pinning of unlocked accolades up to MAX_PINNED_ACCOLADES', async () => {
    // Unlock two accolades
    useAccoladesStore.getState().evaluateAndUnlock({
      currentStreak: 30,
      totalReadingSeconds: 90000,
    });

    // Pin 7-day sage
    const pin1 = await useAccoladesStore.getState().togglePin('seven-day-sage');
    expect(pin1).toBe(true);
    expect(useAccoladesStore.getState().isPinned('seven-day-sage')).toBe(true);
    expect(useAccoladesStore.getState().pinnedAccoladeIds).toEqual(['seven-day-sage']);

    // Unpin 7-day sage
    const unpin1 = await useAccoladesStore.getState().togglePin('seven-day-sage');
    expect(unpin1).toBe(true);
    expect(useAccoladesStore.getState().isPinned('seven-day-sage')).toBe(false);
    expect(useAccoladesStore.getState().pinnedAccoladeIds).toEqual([]);
  });

  it('rejects pinning locked accolades', async () => {
    const success = await useAccoladesStore.getState().togglePin('centurion-of-letters');
    expect(success).toBe(false);
    expect(useAccoladesStore.getState().pinnedAccoladeIds).toEqual([]);
  });

  it('enforces maximum pinned limit of 3 accolades', async () => {
    // Unlock several
    useAccoladesStore.getState().evaluateAndUnlock({
      currentStreak: 30,
      totalReadingSeconds: 90000,
      totalListeningSeconds: 18000,
      totalAnnotationsCount: 15,
    });

    // Pin 3 accolades
    await useAccoladesStore.getState().togglePin('seven-day-sage');
    await useAccoladesStore.getState().togglePin('equinox-scholar');
    await useAccoladesStore.getState().togglePin('the-marathon-reader');

    expect(useAccoladesStore.getState().pinnedAccoladeIds.length).toBe(MAX_PINNED_ACCOLADES);

    // Attempting to pin a 4th should be rejected
    const pin4 = await useAccoladesStore.getState().togglePin('audio-ascetic');
    expect(pin4).toBe(false);
    expect(useAccoladesStore.getState().pinnedAccoladeIds.length).toBe(MAX_PINNED_ACCOLADES);
  });

  it('retrieves pinned accolade definitions via selector', async () => {
    useAccoladesStore.getState().evaluateAndUnlock({ currentStreak: 7 });
    await useAccoladesStore.getState().togglePin('seven-day-sage');

    const pinned = useAccoladesStore.getState().getPinnedAccolades();
    expect(pinned.length).toBe(1);
    expect(pinned[0].id).toBe('seven-day-sage');
  });

  it('syncs with cloud by merging remote accolades and pushing local ones', async () => {
    // Set a local unlocked accolade
    useAccoladesStore.getState().evaluateAndUnlock({ currentStreak: 7 });

    // Mock remote returning a different unlocked accolade
    mockEq.mockResolvedValueOnce({
      data: [
        {
          id: 'remote-row-1',
          user_id: 'user-123',
          accolade_id: 'century-voyager',
          unlocked_at: '2026-09-01T12:00:00.000Z',
          is_pinned: true,
          metadata: {},
          created_at: '2026-09-01T12:00:00.000Z',
          updated_at: '2026-09-01T12:00:00.000Z',
        },
      ],
      error: null,
    });

    await useAccoladesStore.getState().syncWithCloud('user-123');

    const state = useAccoladesStore.getState();
    // Both local 'seven-day-sage' and remote 'century-voyager' should now be present
    expect(state.unlockedAccolades['seven-day-sage']).toBeDefined();
    expect(state.unlockedAccolades['century-voyager']).toBeDefined();
    expect(state.pinnedAccoladeIds).toContain('century-voyager');

    // Local accolade not in cloud should have been pushed via upsert
    expect(mockUpsert).toHaveBeenCalled();
  });
});

