import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CollectionBottomDock } from './CollectionBottomDock';

describe('CollectionBottomDock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders search, filter, direction toggle, and scroll-to-top buttons', () => {
    const handleSearchToggle = vi.fn();
    const handleOpenFilters = vi.fn();
    const handleDirectionToggle = vi.fn();

    render(
      <CollectionBottomDock
        isVisible={true}
        searchQuery=""
        onSearchToggle={handleSearchToggle}
        onOpenFilters={handleOpenFilters}
        modeType="direction"
        sortDirection="desc"
        onDirectionToggle={handleDirectionToggle}
      />
    );

    const searchBtn = screen.getByTestId('collection-dock-search-btn');
    const filtersBtn = screen.getByTestId('collection-dock-filters-btn');
    const directionBtn = screen.getByTestId('collection-dock-direction-btn');
    const topBtn = screen.getByTestId('collection-dock-top-btn');
    const dock = screen.getByTestId('collection-bottom-dock');

    expect(dock).not.toHaveClass('lg:hidden');
    expect(searchBtn).toBeInTheDocument();
    expect(filtersBtn).toBeInTheDocument();
    expect(directionBtn).toBeInTheDocument();
    expect(directionBtn).toHaveClass('group/dockdir');
    expect(directionBtn.querySelector('svg')).toHaveClass('pointer-events-none');
    expect(directionBtn).toHaveAttribute('aria-label', 'Sort ascending');
    expect(topBtn).toBeInTheDocument();

    fireEvent.click(searchBtn);
    expect(handleSearchToggle).toHaveBeenCalledTimes(1);

    fireEvent.click(filtersBtn);
    expect(handleOpenFilters).toHaveBeenCalledTimes(1);

    fireEvent.click(directionBtn);
    expect(handleDirectionToggle).toHaveBeenCalledTimes(1);
  });

  it('displays active filter count badge with invariant button geometry when activeFilterCount > 0', () => {
    render(
      <CollectionBottomDock
        isVisible={true}
        searchQuery=""
        onSearchToggle={vi.fn()}
        onOpenFilters={vi.fn()}
        activeFilterCount={3}
      />
    );

    const filtersBtn = screen.getByTestId('collection-dock-filters-btn');
    expect(filtersBtn).toHaveClass('w-8');
    expect(filtersBtn).toHaveClass('h-8');

    const badge = screen.getByTestId('collection-dock-filters-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('3');
  });

  it('renders view mode toggle when modeType is view_mode', () => {
    const handleViewModeToggle = vi.fn();
    render(
      <CollectionBottomDock
        isVisible={true}
        searchQuery=""
        onSearchToggle={vi.fn()}
        onOpenFilters={vi.fn()}
        modeType="view_mode"
        viewMode="book"
        onViewModeToggle={handleViewModeToggle}
      />
    );

    const viewModeBtn = screen.getByTestId('collection-dock-view-mode-btn');
    expect(viewModeBtn).toBeInTheDocument();

    fireEvent.click(viewModeBtn);
    expect(handleViewModeToggle).toHaveBeenCalledTimes(1);
  });

  it('disables direction toggle when isDirectionDisabled is true', () => {
    const handleDirectionToggle = vi.fn();
    render(
      <CollectionBottomDock
        isVisible={true}
        searchQuery=""
        onSearchToggle={vi.fn()}
        onOpenFilters={vi.fn()}
        modeType="direction"
        sortDirection="asc"
        onDirectionToggle={handleDirectionToggle}
        isDirectionDisabled={true}
      />
    );

    const directionBtn = screen.getByTestId('collection-dock-direction-btn');
    expect(directionBtn).toBeDisabled();

    fireEvent.click(directionBtn);
    expect(handleDirectionToggle).not.toHaveBeenCalled();
  });

  it('scrolls to top when scroll-to-top button is clicked while scrolled, and mutes button when at top', () => {
    const handleScrollToTop = vi.fn();
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true });

    render(
      <CollectionBottomDock
        isVisible={true}
        searchQuery=""
        onSearchToggle={vi.fn()}
        onOpenFilters={vi.fn()}
        onScrollToTop={handleScrollToTop}
      />
    );

    const topBtn = screen.getByTestId('collection-dock-top-btn');
    // At top (scrollY = 0 < 60): muted and disabled
    expect(topBtn).toHaveAttribute('aria-disabled', 'true');
    expect(topBtn).toHaveClass('opacity-25', 'pointer-events-none');

    // Scroll down past 60px
    act(() => {
      window.scrollY = 200;
      window.dispatchEvent(new Event('scroll'));
    });

    expect(topBtn).not.toHaveClass('pointer-events-none');
    fireEvent.click(topBtn);
    expect(handleScrollToTop).toHaveBeenCalledTimes(1);
  });

  it('renders hardware-accelerated ambient light aura and multi-stop dark/sepia shadows', () => {
    render(
      <CollectionBottomDock
        isVisible={true}
        searchQuery=""
        onSearchToggle={vi.fn()}
        onOpenFilters={vi.fn()}
      />
    );

    const aura = screen.getByTestId('collection-dock-ambient-aura');
    expect(aura).toBeInTheDocument();
    expect(aura).toHaveClass('-inset-1.5', 'blur-md', 'rounded-full');

    const dock = screen.getByTestId('collection-bottom-dock');
    const capsule = dock.querySelector('.bg-card\\/95');
    expect(capsule).toBeInTheDocument();
    expect(capsule).toHaveClass('rounded-full', 'backdrop-blur-md');
  });

  it('handles idle dimming timeout and wake-up on pointer interactions', () => {
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true });

    render(
      <CollectionBottomDock
        isVisible={true}
        searchQuery=""
        onSearchToggle={vi.fn()}
        onOpenFilters={vi.fn()}
        idleTimeoutMs={1000}
      />
    );

    const dock = screen.getByTestId('collection-bottom-dock');
    // Initially at top: resting in dimmed state (opacity-30)
    expect(dock).toHaveClass('opacity-30');

    // Scroll down to wake up
    act(() => {
      window.scrollY = 200;
      window.dispatchEvent(new Event('scroll'));
    });
    expect(dock).toHaveClass('opacity-100');

    // Advance past idle timeout -> dims back to opacity-30
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(dock).toHaveClass('opacity-30');

    // Pointer down wakes up dock
    fireEvent.pointerDown(dock);
    expect(dock).toHaveClass('opacity-100');
  });
});
