import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AccountAccoladesCard } from './AccountAccoladesCard';
import { useAccoladesStore } from '@/stores/useAccoladesStore';
import { useHabitsStore } from '@/stores/useHabitsStore';


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

  it('renders card title, subtitle, and subtle category indicator without inline tab strip', () => {
    render(<AccountAccoladesCard />);

    expect(screen.getByTestId('account-accolades-card')).toHaveClass('rounded-3xl', 'p-5', 'sm:p-6', 'lg:p-8', 'shadow-xs');
    expect(screen.getByText('Ex-Libris Bookplates & Accolades')).toBeInTheDocument();
    expect(screen.getByText(/Classical honors for scholarly streaks/i)).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.getByTestId('accolades-active-category-badge')).toHaveTextContent('All Bookplates');
    expect(screen.queryByTestId('accolades-reset-filter-btn')).not.toBeInTheDocument();
  });

  it('shows empty showcase message when no bookplates are pinned', () => {
    render(<AccountAccoladesCard />);

    expect(
      screen.getByText(/No bookplates pinned yet\. Unlock achievements/i)
    ).toBeInTheDocument();
  });

  it('supports controlled activeCategory filtering, open filter trigger, and Show all reset pill', () => {
    const onCategoryChange = vi.fn();
    const onOpenFilter = vi.fn();

    const { rerender } = render(
      <AccountAccoladesCard
        activeCategory="all"
        onCategoryChange={onCategoryChange}
        onOpenFilter={onOpenFilter}
      />
    );

    // In 'All Bookplates', multiple accolades from different categories are visible
    expect(screen.getByText('Seven-Day Sage')).toBeInTheDocument();
    expect(screen.getByText('The Marathon Reader')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('accolades-open-filter-btn'));
    expect(onOpenFilter).toHaveBeenCalledTimes(1);

    // Filtered to Streaks
    rerender(
      <AccountAccoladesCard
        activeCategory="streaks"
        onCategoryChange={onCategoryChange}
        onOpenFilter={onOpenFilter}
      />
    );

    expect(screen.getByTestId('accolades-open-filter-btn')).toHaveTextContent('Streaks');
    expect(screen.getByText('Seven-Day Sage')).toBeInTheDocument();
    expect(screen.queryByText('The Marathon Reader')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('accolades-reset-filter-btn'));
    expect(onCategoryChange).toHaveBeenCalledWith('all');
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

  it('invokes cloud sync on mount with passive cooldown if userId is provided', async () => {
    const syncSpy = vi.spyOn(useAccoladesStore.getState(), 'syncWithCloud').mockResolvedValue();
    render(<AccountAccoladesCard userId="user-999" />);

    await waitFor(() => {
      expect(syncSpy).toHaveBeenCalledWith('user-999', { minSyncIntervalMs: 15_000 });
    });
  });

  it('applies theme-aware solid borders without vanishing fractional opacities', () => {
    const { container } = render(<AccountAccoladesCard />);
    const html = container.innerHTML;

    expect(html).not.toContain('border-border/80');
    expect(html).not.toContain('border-border/70');
    expect(html).not.toContain('border-border/60');
    expect(html).not.toContain('border-border/50');
    expect(html).not.toContain('border-border/40');
  });
});

