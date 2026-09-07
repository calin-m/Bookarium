import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AccountAccoladesCard } from './AccountAccoladesCard';
import { useAccoladesStore } from '@/stores/useAccoladesStore';
import { useHabitsStore } from '@/stores/useHabitsStore';

const mockSyncWithCloud = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockReturnThis(),
    })),
  })),
}));

describe('AccountAccoladesCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useAccoladesStore.getState().resetAccolades();
    useHabitsStore.getState().resetHabits();
  });

  it('renders card title, subtitle, and category tabs', () => {
    render(<AccountAccoladesCard />);

    expect(screen.getByText('Ex-Libris Bookplates & Accolades')).toBeInTheDocument();
    expect(screen.getByText(/Classical honors for scholarly streaks/i)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'All Bookplates' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Streaks' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Immersion' })).toBeInTheDocument();
  });

  it('shows empty showcase message when no bookplates are pinned', () => {
    render(<AccountAccoladesCard />);

    expect(
      screen.getByText(/No bookplates pinned yet\. Unlock achievements/i)
    ).toBeInTheDocument();
  });

  it('filters bookplates when clicking category tabs', () => {
    render(<AccountAccoladesCard />);

    // In 'All Bookplates', multiple accolades from different categories are visible
    expect(screen.getByText('Seven-Day Sage')).toBeInTheDocument();
    expect(screen.getByText('The Marathon Reader')).toBeInTheDocument();

    // Click 'Streaks' tab
    const streaksTab = screen.getByRole('tab', { name: 'Streaks' });
    fireEvent.click(streaksTab);

    expect(screen.getByText('Seven-Day Sage')).toBeInTheDocument();
    // 'The Marathon Reader' is in Immersion category, should not be in the compendium grid
    expect(screen.queryByText('The Marathon Reader')).not.toBeInTheDocument();
  });

  it('renders pinned bookplate in showcase when pinned', async () => {
    // Unlock and pin Seven-Day Sage
    useAccoladesStore.getState().evaluateAndUnlock({ currentStreak: 7 });
    await useAccoladesStore.getState().togglePin('seven-day-sage');

    render(<AccountAccoladesCard />);

    // Pinned should show in personal showcase
    expect(screen.getByText(/Personal Showcase \(1\/3\)/i)).toBeInTheDocument();
  });

  it('displays warning when trying to pin more than 3 bookplates', async () => {
    // Unlock several accolades
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

    render(<AccountAccoladesCard />);

    // Try pinning a 4th from the compendium
    const audioPinBtn = screen.getByRole('button', { name: /pin audio ascetic to showcase/i });
    fireEvent.click(audioPinBtn);

    expect(
      await screen.findByText(/Showcase limit reached \(maximum 3 bookplates\)/i)
    ).toBeInTheDocument();
  });

  it('invokes cloud sync on mount if userId is provided', async () => {
    const syncSpy = vi.spyOn(useAccoladesStore.getState(), 'syncWithCloud').mockResolvedValue();
    render(<AccountAccoladesCard userId="user-999" />);

    await waitFor(() => {
      expect(syncSpy).toHaveBeenCalledWith('user-999');
    });
  });
});

