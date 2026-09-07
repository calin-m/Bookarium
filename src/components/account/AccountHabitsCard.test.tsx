import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AccountHabitsCard } from './AccountHabitsCard';
import { useHabitsStore } from '@/stores/useHabitsStore';

describe('AccountHabitsCard', () => {
  beforeEach(() => {
    localStorage.clear();
    useHabitsStore.getState().resetHabits();
  });

  it('renders reading habits card with streak, duration, and challenge horizontal strips', () => {
    useHabitsStore.getState().recordDailyActivity('2026-09-06');
    useHabitsStore.getState().addReadingDuration(3600); // 1.0 hrs
    useHabitsStore.getState().setAnnualGoal(20, 2026);

    render(<AccountHabitsCard completedBooksCount={5} />);

    expect(screen.getByRole('heading', { level: 2, name: /Reading Habits & Challenges/i })).toBeInTheDocument();
    expect(screen.getByTestId('reading-streak-metric')).toBeInTheDocument();
    expect(screen.getByTestId('reading-time-metric')).toBeInTheDocument();
    expect(screen.getByTestId('annual-goal-metric')).toBeInTheDocument();

    // Challenge shows 5 / 20 Volumes (25%)
    const goalMetric = screen.getByTestId('annual-goal-metric');
    expect(goalMetric).toHaveTextContent('5');
    expect(goalMetric).toHaveTextContent('/ 20 Volumes');
    expect(goalMetric).toHaveTextContent('25%');
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

  it('opens edit modal and allows backspacing, presets, pace hints, and saving goal', () => {
    useHabitsStore.getState().setAnnualGoal(12, 2026);

    render(<AccountHabitsCard completedBooksCount={2} />);

    const editBtn = screen.getByRole('button', { name: /Edit annual reading goal/i });
    fireEvent.click(editBtn);

    // Modal opens
    expect(screen.getByRole('heading', { level: 2, name: /Set 2026 Reading Challenge/i })).toBeInTheDocument();

    // Default pace hint for 12 volumes
    expect(screen.getByText(/~1.0 volume per month/i)).toBeInTheDocument();

    const getInput = () => screen.getByLabelText('Annual reading target number') as HTMLInputElement;
    expect(getInput().value).toBe('12');

    // Test backspacing: clearing input to empty string does not get stuck
    fireEvent.change(getInput(), { target: { value: '' } });
    expect(getInput().value).toBe('');
    expect(screen.getByText(/Set an annual target to see your reading pace/i)).toBeInTheDocument();

    // Type 24
    fireEvent.change(getInput(), { target: { value: '24' } });
    expect(getInput().value).toBe('24');
    expect(screen.getByText(/~2.0 volumes per month/i)).toBeInTheDocument();

    // Click preset 52
    const preset52Btn = screen.getByRole('button', { name: /52 \(1\/wk\)/i });
    fireEvent.click(preset52Btn);
    expect(getInput().value).toBe('52');
    expect(screen.getByText(/~1.0 volume per week/i)).toBeInTheDocument();

    // Adjust target with + button
    const increaseBtn = screen.getByRole('button', { name: /Increase target/i });
    fireEvent.click(increaseBtn);
    expect(getInput().value).toBe('53');

    // Save challenge
    const saveBtn = screen.getByRole('button', { name: /Save Challenge/i });
    fireEvent.click(saveBtn);

    // Goal in store updated
    expect(useHabitsStore.getState().annualGoal).toBe(53);
  });

  it('displays completion message when annual target is met', () => {
    useHabitsStore.getState().setAnnualGoal(5, 2026);

    render(<AccountHabitsCard completedBooksCount={5} />);

    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText(/Challenge completed! 🎉/i)).toBeInTheDocument();
  });

  it('triggers cloud sync on mount when authenticated userId is provided', () => {
    const syncMock = vi.fn().mockResolvedValue(undefined);
    useHabitsStore.setState({ syncWithCloud: syncMock });

    render(<AccountHabitsCard userId="user-sync-1" completedBooksCount={3} />);

    expect(syncMock).toHaveBeenCalledWith('user-sync-1');
  });

  it('allows user to enter arbitrary custom goal, clamps on blur, updates pace hint, and reflects changes on the card UI', () => {
    useHabitsStore.getState().setAnnualGoal(12, 2026);

    render(<AccountHabitsCard completedBooksCount={6} />);

    // Initially 12 volumes goal, 6 completed = 50%
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText(/6 volumes remaining/i)).toBeInTheDocument();
    expect(screen.getByText(/12 Volumes Goal/i)).toBeInTheDocument();

    // Open edit modal
    const editBtn = screen.getByRole('button', { name: /Edit annual reading goal/i });
    fireEvent.click(editBtn);

    const getInput = () => screen.getByLabelText('Annual reading target number') as HTMLInputElement;

    // Test typing an arbitrary custom value: 30 volumes
    fireEvent.change(getInput(), { target: { value: '30' } });
    expect(getInput().value).toBe('30');
    // 30 / 12 = 2.5
    expect(screen.getByText(/~2.5 volumes per month/i)).toBeInTheDocument();

    // Test onBlur clamping with out-of-range value > 365
    fireEvent.change(getInput(), { target: { value: '999' } });
    fireEvent.blur(getInput());
    expect(getInput().value).toBe('365');

    // Test onBlur clamping with empty input
    fireEvent.change(getInput(), { target: { value: '' } });
    fireEvent.blur(getInput());
    expect(getInput().value).toBe('1');

    // Set custom target to 30 and save
    fireEvent.change(getInput(), { target: { value: '30' } });
    const saveBtn = screen.getByRole('button', { name: /Save Challenge/i });
    fireEvent.click(saveBtn);

    // Modal closed
    expect(screen.queryByRole('heading', { name: /Set 2026 Reading Challenge/i })).not.toBeInTheDocument();

    // Card UI updated to new custom goal: 6 of 30 = 20%, 24 remaining
    expect(screen.getByText('20%')).toBeInTheDocument();
    expect(screen.getByText(/24 volumes remaining/i)).toBeInTheDocument();
    expect(screen.getByText(/30 Volumes Goal/i)).toBeInTheDocument();
    expect(useHabitsStore.getState().annualGoal).toBe(30);
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

