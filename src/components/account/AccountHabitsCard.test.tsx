import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AccountHabitsCard } from './AccountHabitsCard';
import { useHabitsStore } from '@/stores/useHabitsStore';

describe('AccountHabitsCard', () => {
  beforeEach(() => {
    localStorage.clear();
    useHabitsStore.getState().resetHabits();
  });

  it('renders reading habits card with streak, duration, and canonical challenge horizontal strips', () => {
    useHabitsStore.getState().recordDailyActivity('2026-09-06');
    useHabitsStore.getState().addReadingDuration(3600); // 1.0 hrs

    render(<AccountHabitsCard completedBooksCount={5} />);

    expect(screen.getByRole('heading', { level: 2, name: /Reading Habits & Challenges/i })).toBeInTheDocument();
    expect(screen.getByTestId('reading-streak-metric')).toBeInTheDocument();
    expect(screen.getByTestId('reading-time-metric')).toBeInTheDocument();
    expect(screen.getByTestId('annual-goal-metric')).toBeInTheDocument();

    // Challenge shows 5 / 6 Volumes (83%) toward Bibliophile Novice
    const goalMetric = screen.getByTestId('annual-goal-metric');
    expect(goalMetric).toHaveTextContent('5');
    expect(goalMetric).toHaveTextContent('/ 6 Volumes');
    expect(goalMetric).toHaveTextContent('83%');
    expect(goalMetric).toHaveTextContent(/1 volume remaining to unlock Bibliophile Novice/i);
    expect(goalMetric).toHaveTextContent(/Bibliophile Novice in sight/i);
  });

  it('renders 7-day activity indicators in the streak strip', () => {
    useHabitsStore.getState().recordDailyActivity('2026-09-06');

    render(<AccountHabitsCard completedBooksCount={0} />);

    const weekGroup = screen.getByRole('group', { name: '7-day activity' });
    expect(weekGroup).toBeInTheDocument();
    expect(weekGroup.children.length).toBe(7);
  });

  it('displays today 5-minute reading logged indicator when read today', () => {
    useHabitsStore.getState().recordDailyActivity();

    render(<AccountHabitsCard completedBooksCount={0} />);

    expect(screen.getByText(/Today's 5-minute reading logged/i)).toBeInTheDocument();
  });

  it('displays remaining streak progress prompt when partially read today', () => {
    useHabitsStore.getState().addReadingDuration(120); // 2 minutes

    render(<AccountHabitsCard completedBooksCount={0} />);

    expect(screen.getByText(/2m \/ 5m logged today \(3m to start streak\)/i)).toBeInTheDocument();
  });

  it('renders dual immersion breakdown badges for reading and listening time', () => {
    useHabitsStore.getState().addReadingDuration(3600); // 1.0 hr
    useHabitsStore.getState().addListeningDuration(1800); // 30 min

    render(<AccountHabitsCard completedBooksCount={0} />);

    const readingBadge = screen.getByTestId('reading-duration-badge');
    const listeningBadge = screen.getByTestId('listening-duration-badge');

    expect(readingBadge).toBeInTheDocument();
    expect(readingBadge).toHaveTextContent(/1.0 hrs/i);

    expect(listeningBadge).toBeInTheDocument();
    expect(listeningBadge).toHaveTextContent(/30 min/i);
  });

  it('renders canonical 4-tier milestone ladder cards with titles, Latin mottos, and paces', () => {
    render(<AccountHabitsCard completedBooksCount={0} />);

    expect(screen.getByText('Canonical Milestone Ladder')).toBeInTheDocument();
    expect(screen.getByTestId('milestone-tier-bibliophile-novice')).toBeInTheDocument();
    expect(screen.getByTestId('milestone-tier-canonical-scholar')).toBeInTheDocument();
    expect(screen.getByTestId('milestone-tier-master-of-the-canon')).toBeInTheDocument();
    expect(screen.getByTestId('milestone-tier-the-laureates-crown')).toBeInTheDocument();

    expect(screen.getByText('“Ad Initium”')).toBeInTheDocument();
    expect(screen.getByText('“Annus Mirabilis”')).toBeInTheDocument();
    expect(screen.getByText('“Litterarum Magister”')).toBeInTheDocument();
    expect(screen.getByText('“Coronam Accipere”')).toBeInTheDocument();
  });

  it('elevates milestone target dynamically as reader completes books', () => {
    // 3 books completed: In sight of Bibliophile Novice (target: 6)
    const { rerender } = render(<AccountHabitsCard completedBooksCount={3} />);
    expect(screen.getByText(/3 volumes remaining to unlock Bibliophile Novice/i)).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();

    // 8 books completed: Novice attained, in sight of Canonical Scholar (target: 12)
    rerender(<AccountHabitsCard completedBooksCount={8} />);
    expect(screen.getByText(/4 volumes remaining to unlock Canonical Scholar/i)).toBeInTheDocument();
    expect(screen.getByText('67%')).toBeInTheDocument();
    const noviceCard = screen.getByTestId('milestone-tier-bibliophile-novice');
    expect(noviceCard).toHaveTextContent(/Attained/i);

    // 20 books completed: Scholar attained, in sight of Master of the Canon (target: 24)
    rerender(<AccountHabitsCard completedBooksCount={20} />);
    expect(screen.getByText(/4 volumes remaining to unlock Master of the Canon/i)).toBeInTheDocument();
    expect(screen.getByText('83%')).toBeInTheDocument();

    // 52 books completed: Masterwork achieved
    rerender(<AccountHabitsCard completedBooksCount={52} />);
    expect(screen.getByText("The Laureate's Crown achieved! 🎉 All 52 canonical volumes completed.")).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('Masterwork Attained')).toBeInTheDocument();
  });

  it('does not expose arbitrary user edit buttons or input fields (anti-tamper integrity)', () => {
    render(<AccountHabitsCard completedBooksCount={5} />);

    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Annual reading target number/i)).not.toBeInTheDocument();
  });

  it('triggers cloud sync on mount when authenticated userId is provided', () => {
    const syncMock = vi.fn().mockResolvedValue(undefined);
    useHabitsStore.setState({ syncWithCloud: syncMock });

    render(<AccountHabitsCard userId="user-sync-1" completedBooksCount={3} />);

    expect(syncMock).toHaveBeenCalledWith('user-sync-1');
  });

  it('applies theme-aware solid borders and surfaces without fractional opacity variants that vanish in Sepia or Dark mode', () => {
    const { container } = render(<AccountHabitsCard completedBooksCount={3} />);

    // 3 Strips should use bg-muted/30 and tactile hover:border-primary/40, never bg-background/60 or hover:border-border/80
    const streakStrip = screen.getByTestId('reading-streak-metric');
    const timeStrip = screen.getByTestId('reading-time-metric');
    const goalStrip = screen.getByTestId('annual-goal-metric');

    [streakStrip, timeStrip, goalStrip].forEach((strip) => {
      expect(strip).toHaveClass('bg-muted/30');
      expect(strip).toHaveClass('border-border');
      expect(strip).toHaveClass('hover:border-primary/40');
      expect(strip.className).not.toContain('bg-background/60');
      expect(strip.className).not.toContain('hover:border-border/80');
    });

    // Entire card should never contain vanishing fractional border opacities
    const cardHtml = container.innerHTML;
    expect(cardHtml).not.toContain('border-border/60');
    expect(cardHtml).not.toContain('border-border/50');
    expect(cardHtml).not.toContain('border-border/40');

    // Progress bar track should use bg-secondary border border-border
    const progressTrack = container.querySelector('.bg-secondary.rounded-full');
    expect(progressTrack).toBeInTheDocument();
    expect(progressTrack).toHaveClass('border-border');

    // Percentage pill should use solid border-border and never border-primary/20
    const percentPill = screen.getByText(/\d+%/);
    expect(percentPill).toHaveClass('border-border');
    expect(percentPill.className).not.toContain('border-primary/20');
  });
});

