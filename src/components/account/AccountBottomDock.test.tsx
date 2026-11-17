import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AccountBottomDock } from './AccountBottomDock';

describe('AccountBottomDock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'scrollY', { configurable: true, writable: true, value: 0 });
    window.scrollTo = vi.fn();
  });

  it('renders ambient capsule with data-no-swipe, muted scroll-to-top at scrollY=0, and active scroll-to-top when scrolled', () => {
    render(<AccountBottomDock mode="profile" />);

    const dock = screen.getByTestId('account-bottom-dock');
    expect(dock).toBeInTheDocument();
    expect(screen.getByTestId('account-dock-ambient-aura')).toBeInTheDocument();

    const swipeGuard = dock.querySelector('[data-no-swipe="true"]');
    expect(swipeGuard).not.toBeNull();

    const topBtn = screen.getByTestId('account-dock-top-btn');
    expect(topBtn).toBeDisabled();

    // Scroll down to activate top button and test wake/dimming handlers
    window.scrollY = 400;
    fireEvent.scroll(window);
    expect(topBtn).not.toBeDisabled();

    fireEvent.pointerEnter(dock);
    fireEvent.pointerDown(dock);
    fireEvent.pointerLeave(dock);

    fireEvent.click(topBtn);
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });

  it('supports profile mode section quick jumps and pending invite badge without public showcase link', () => {
    const onJumpToSection = vi.fn();
    render(
      <AccountBottomDock
        mode="profile"
        onJumpToSection={onJumpToSection}
        pendingInvitesCount={3}
      />
    );

    expect(screen.getByTestId('account-dock-invites-badge')).toHaveTextContent('3');
    expect(screen.queryByTestId('account-dock-public-link')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('account-dock-jump-identity'));
    expect(onJumpToSection).toHaveBeenCalledWith('scholar-profile-section');

    fireEvent.click(screen.getByTestId('account-dock-jump-fellowship'));
    expect(onJumpToSection).toHaveBeenCalledWith('account-symposium-section');
  });

  it('supports habits mode jumps, accolade category filter popover selection, Escape, and outside click dismissal', () => {
    const onAccoladeCategoryChange = vi.fn();
    const onJumpToSection = vi.fn();

    render(
      <AccountBottomDock
        mode="habits"
        onJumpToSection={onJumpToSection}
        accoladeCategory="all"
        onAccoladeCategoryChange={onAccoladeCategoryChange}
      />
    );

    fireEvent.click(screen.getByTestId('account-dock-jump-streaks'));
    expect(onJumpToSection).toHaveBeenCalledWith('account-habits-card');

    fireEvent.click(screen.getByTestId('account-dock-jump-accolades'));
    expect(onJumpToSection).toHaveBeenCalledWith('account-accolades-card');

    // Open category popover
    const filterBtn = screen.getByTestId('account-dock-filter-btn');
    expect(filterBtn).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(filterBtn);
    expect(screen.getByTestId('account-dock-filter-popover')).toBeInTheDocument();

    // Select Streaks category
    fireEvent.click(screen.getByTestId('account-dock-category-streaks'));
    expect(onAccoladeCategoryChange).toHaveBeenCalledWith('streaks');
    expect(onJumpToSection).toHaveBeenLastCalledWith('account-accolades-card');
    expect(screen.queryByTestId('account-dock-filter-popover')).not.toBeInTheDocument();

    // Re-open and close with Escape
    fireEvent.click(filterBtn);
    expect(screen.getByTestId('account-dock-filter-popover')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('account-dock-filter-popover')).not.toBeInTheDocument();

    // Re-open and close with outside pointerdown
    fireEvent.click(filterBtn);
    expect(screen.getByTestId('account-dock-filter-popover')).toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByTestId('account-dock-filter-popover')).not.toBeInTheDocument();
  });

  it('supports preferences quick theme cycler and narration/display jumps', () => {
    const onJumpToSection = vi.fn();
    const onCycleTheme = vi.fn();

    render(
      <AccountBottomDock
        mode="preferences"
        theme="sepia"
        onCycleTheme={onCycleTheme}
        onJumpToSection={onJumpToSection}
      />
    );

    fireEvent.click(screen.getByTestId('account-dock-jump-appearance'));
    expect(onJumpToSection).toHaveBeenCalledWith('preferences-subpanel-appearance');

    fireEvent.click(screen.getByTestId('account-dock-jump-narration'));
    expect(onJumpToSection).toHaveBeenCalledWith('preferences-subpanel-narration');

    const themeBtn = screen.getByTestId('account-dock-cycle-theme-btn');
    expect(themeBtn).toHaveTextContent('sepia');
    fireEvent.click(themeBtn);
    expect(onCycleTheme).toHaveBeenCalledTimes(1);
  });

  it('supports security anchors, online session refresh, guest-offline switcher, and guest top-hiding', () => {
    const onJumpToSection = vi.fn();
    const onRefreshSessions = vi.fn();
    const onSwitchGuestMode = vi.fn();

    const { rerender } = render(
      <AccountBottomDock
        mode="security"
        onJumpToSection={onJumpToSection}
        onRefreshSessions={onRefreshSessions}
        isOffline={false}
      />
    );

    fireEvent.click(screen.getByTestId('account-dock-jump-password'));
    expect(onJumpToSection).toHaveBeenCalledWith('security-password-card');

    fireEvent.click(screen.getByTestId('account-dock-jump-sessions'));
    expect(onJumpToSection).toHaveBeenCalledWith('security-sessions-card');

    fireEvent.click(screen.getByTestId('account-dock-jump-danger'));
    expect(onJumpToSection).toHaveBeenCalledWith('security-danger-card');

    fireEvent.click(screen.getByTestId('account-dock-refresh-sessions-btn'));
    expect(onRefreshSessions).toHaveBeenCalledTimes(1);

    // Offline hides/omits refresh control
    rerender(
      <AccountBottomDock
        mode="security"
        onJumpToSection={onJumpToSection}
        onRefreshSessions={onRefreshSessions}
        isOffline
      />
    );
    expect(screen.queryByTestId('account-dock-refresh-sessions-btn')).not.toBeInTheDocument();

    // Guest offline switcher
    rerender(
      <AccountBottomDock
        mode="guest-preferences"
        onSwitchGuestMode={onSwitchGuestMode}
      />
    );
    fireEvent.click(screen.getByTestId('account-dock-guest-habits-btn'));
    expect(onSwitchGuestMode).toHaveBeenCalledWith('habits');

    // Guest online hidden when at top, visible when scrolled
    rerender(<AccountBottomDock mode="guest" />);
    expect(screen.queryByTestId('account-bottom-dock')).not.toBeInTheDocument();

    window.scrollY = 300;
    fireEvent.scroll(window);
    expect(screen.getByTestId('account-bottom-dock')).toBeInTheDocument();
  });

  it('computes smooth target scroll coordinates when using default section jump handler', () => {
    const mockTarget = document.createElement('section');
    mockTarget.id = 'scholar-profile-section';
    vi.spyOn(mockTarget, 'getBoundingClientRect').mockReturnValue({
      top: 320,
      bottom: 600,
      left: 0,
      right: 1000,
      width: 1000,
      height: 280,
      x: 0,
      y: 320,
      toJSON: () => {},
    });
    document.body.appendChild(mockTarget);

    try {
      render(<AccountBottomDock mode="profile" />);
      fireEvent.click(screen.getByTestId('account-dock-jump-identity'));
      expect(window.scrollTo).toHaveBeenCalledWith({ top: 232, behavior: 'smooth' });
    } finally {
      mockTarget.remove();
    }
  });
});
