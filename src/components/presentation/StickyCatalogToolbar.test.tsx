import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { StickyCatalogToolbar, formatApiLatency } from './StickyCatalogToolbar';

describe('StickyCatalogToolbar component', () => {
  it('should render filter trigger, active chips, and unified API status badge', () => {
    render(
      <StickyCatalogToolbar
        page={1}
        viewMode="grid"
        onViewModeChange={vi.fn()}
        onOpenFilters={vi.fn()}
        activeFilterCount={2}
        activeFilterChips={[
          { id: 'era', label: 'Victorian', onRemove: vi.fn() },
          { id: 'lang', label: 'French', onRemove: vi.fn() },
        ]}
        onClearAllFilters={vi.fn()}
        latencyMs={85}
      />
    );

    expect(screen.getAllByText('Filters')[0]).toBeInTheDocument();
    expect(screen.getAllByText('2')[0]).toBeInTheDocument();
    expect(screen.getByText('Victorian')).toBeInTheDocument();
    expect(screen.getByText('French')).toBeInTheDocument();
    expect(screen.getByTestId('api-status-badge')).toHaveTextContent('85ms');
    expect(screen.getByTestId('api-latency-badge')).toHaveTextContent('85ms');
    expect(screen.getByTestId('api-status-dot')).toHaveClass('bg-success');
  });

  it('should handle page size selection and reflect aria-pressed state', () => {
    const handlePageSizeChange = vi.fn();
    render(
      <StickyCatalogToolbar
        page={1}
        viewMode="grid"
        onViewModeChange={vi.fn()}
        onOpenFilters={vi.fn()}
        activeFilterCount={0}
        activeFilterChips={[]}
        onClearAllFilters={vi.fn()}
        pageSize={16}
        onPageSizeChange={handlePageSizeChange}
      />
    );

    expect(screen.getByText('Show:')).toBeInTheDocument();
    const size8Btn = screen.getByLabelText('Show 8 books per page');
    const size16Btn = screen.getByLabelText('Show 16 books per page');

    expect(size16Btn).toHaveAttribute('aria-pressed', 'true');
    expect(size8Btn).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(size8Btn);
    expect(handlePageSizeChange).toHaveBeenCalledWith(8);
  });

  it('should trigger filter opening, remove individual chips, and clear all filters', () => {
    const handleOpenFilters = vi.fn();
    const handleRemoveChip = vi.fn();
    const handleClearAll = vi.fn();

    render(
      <StickyCatalogToolbar
        page={1}
        viewMode="grid"
        onViewModeChange={vi.fn()}
        onOpenFilters={handleOpenFilters}
        activeFilterCount={2}
        activeFilterChips={[
          { id: 'era', label: 'Victorian', onRemove: handleRemoveChip },
          { id: 'lang', label: 'French', onRemove: vi.fn() },
        ]}
        onClearAllFilters={handleClearAll}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Open advanced filters/i }));
    expect(handleOpenFilters).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Remove filter Victorian/i }));
    expect(handleRemoveChip).toHaveBeenCalled();

    fireEvent.click(screen.getByText('Clear all'));
    expect(handleClearAll).toHaveBeenCalled();
  });

  it('should handle view mode switching between grid and shelf', () => {
    const handleViewModeChange = vi.fn();
    render(
      <StickyCatalogToolbar
        page={1}
        viewMode="grid"
        onViewModeChange={handleViewModeChange}
        onOpenFilters={vi.fn()}
        activeFilterCount={0}
        activeFilterChips={[]}
        onClearAllFilters={vi.fn()}
      />
    );

    fireEvent.click(screen.getByLabelText('Shelf view'));
    expect(handleViewModeChange).toHaveBeenCalledWith('shelf');
  });

  it('should handle pagination next button and direct page jump form', () => {
    const handlePageChange = vi.fn();
    render(
      <StickyCatalogToolbar
        page={1}
        onPageChange={handlePageChange}
        hasNextPage={true}
        viewMode="grid"
        onViewModeChange={vi.fn()}
        onOpenFilters={vi.fn()}
        activeFilterCount={0}
        activeFilterChips={[]}
        onClearAllFilters={vi.fn()}
      />
    );

    const nextBtn = screen.getByRole('button', { name: /Next page/i });
    fireEvent.click(nextBtn);
    expect(handlePageChange).toHaveBeenCalledWith(2);

    const jumpInput = screen.getByLabelText('Jump to page') as HTMLInputElement;
    expect(jumpInput).toHaveAttribute('inputmode', 'numeric');
    expect(jumpInput).toHaveAttribute('pattern', '[0-9]*');
    expect(jumpInput.value).toBe('1');

    // Simulate focus and tactile click
    fireEvent.focus(jumpInput);
    fireEvent.click(jumpInput);

    // User backspaces to empty string during typing - should not snap back to '1'
    fireEvent.change(jumpInput, { target: { value: '' } });
    expect(jumpInput.value).toBe('');

    // User types '25'
    fireEvent.change(jumpInput, { target: { value: '25' } });
    expect(jumpInput.value).toBe('25');

    fireEvent.submit(jumpInput.closest('form')!);
    expect(handlePageChange).toHaveBeenCalledWith(25);

    // User types new page and commits via blur (e.g. tapping outside / Done key on mobile)
    fireEvent.change(jumpInput, { target: { value: '42' } });
    fireEvent.blur(jumpInput);
    expect(handlePageChange).toHaveBeenCalledWith(42);
  });

  it('should display error indicator in status badge when isError is true', () => {
    render(
      <StickyCatalogToolbar
        page={1}
        viewMode="grid"
        onViewModeChange={vi.fn()}
        onOpenFilters={vi.fn()}
        activeFilterCount={0}
        activeFilterChips={[]}
        onClearAllFilters={vi.fn()}
        isError={true}
      />
    );

    expect(screen.getByTestId('api-status-badge')).toHaveTextContent('Offline');
    expect(screen.getByTestId('api-status-dot')).toHaveClass('bg-destructive');
  });

  describe('formatApiLatency utility and precision second formatting', () => {
    it('formats millisecond latencies under 1000ms and returns ellipsis when undefined', () => {
      expect(formatApiLatency(85)).toBe('85ms');
      expect(formatApiLatency(140)).toBe('140ms');
      expect(formatApiLatency(999)).toBe('999ms');
      expect(formatApiLatency(undefined)).toBe('...');
    });

    it('renders loading indicator when latencyMs is undefined and switches to value once resolved', () => {
      const { rerender } = render(
        <StickyCatalogToolbar
          page={1}
          viewMode="grid"
          onViewModeChange={vi.fn()}
          onOpenFilters={vi.fn()}
          activeFilterCount={0}
          activeFilterChips={[]}
          onClearAllFilters={vi.fn()}
        />
      );

      expect(screen.getByTestId('api-latency-loading')).toBeInTheDocument();
      expect(screen.getByTestId('api-status-badge')).not.toHaveTextContent('140ms');
      expect(screen.getByTestId('api-status-badge')).toHaveAttribute(
        'aria-label',
        'Catalog status: Measuring response time'
      );
      expect(screen.getByTestId('api-status-badge')).not.toHaveAttribute('title');

      rerender(
        <StickyCatalogToolbar
          page={1}
          viewMode="grid"
          onViewModeChange={vi.fn()}
          onOpenFilters={vi.fn()}
          activeFilterCount={0}
          activeFilterChips={[]}
          onClearAllFilters={vi.fn()}
          latencyMs={42}
          catalogSource="supabase"
        />
      );

      expect(screen.queryByTestId('api-latency-loading')).not.toBeInTheDocument();
      expect(screen.getByTestId('api-latency-badge')).toHaveTextContent('42ms');
      expect(screen.getByTestId('api-status-badge')).toHaveAttribute(
        'aria-label',
        'Bookarium Catalog status: Online, response time 42ms'
      );
      expect(screen.getByTestId('api-status-badge')).not.toHaveAttribute('title');

      rerender(
        <StickyCatalogToolbar
          page={1}
          viewMode="grid"
          onViewModeChange={vi.fn()}
          onOpenFilters={vi.fn()}
          activeFilterCount={0}
          activeFilterChips={[]}
          onClearAllFilters={vi.fn()}
          latencyMs={310}
          catalogSource="upstream"
        />
      );

      expect(screen.getByTestId('api-latency-badge')).toHaveTextContent('310ms');
      expect(screen.getByTestId('api-status-badge')).toHaveAttribute(
        'aria-label',
        'Project Gutenberg Mirror status: Online, response time 310ms'
      );
      expect(screen.getByTestId('api-status-badge')).not.toHaveAttribute('title');
    });

    it('formats second latencies at or above 1000ms with up to 3 decimals without trailing zeros', () => {
      expect(formatApiLatency(1000)).toBe('1s');
      expect(formatApiLatency(1200)).toBe('1.2s');
      expect(formatApiLatency(1212)).toBe('1.212s');
      expect(formatApiLatency(2500)).toBe('2.5s');
      expect(formatApiLatency(3000)).toBe('3s');
    });

    it('renders formatted second latency in StickyCatalogToolbar when latencyMs >= 1000', () => {
      render(
        <StickyCatalogToolbar
          page={1}
          viewMode="grid"
          onViewModeChange={vi.fn()}
          onOpenFilters={vi.fn()}
          activeFilterCount={0}
          activeFilterChips={[]}
          onClearAllFilters={vi.fn()}
          latencyMs={1212}
        />
      );

      expect(screen.getByTestId('api-status-badge')).toHaveTextContent('1.212s');
      expect(screen.getByTestId('api-status-dot')).toHaveClass('bg-success');
    });
  });

  it('applies translate-y-0 when isHeaderVisible is true and -translate-y-16 when false', () => {
    const { rerender } = render(
      <StickyCatalogToolbar
        page={1}
        viewMode="grid"
        onViewModeChange={vi.fn()}
        onOpenFilters={vi.fn()}
        activeFilterCount={0}
        activeFilterChips={[]}
        onClearAllFilters={vi.fn()}
        isHeaderVisible={true}
      />
    );

    const toolbar = screen.getByTestId('sticky-catalog-toolbar');
    expect(toolbar).toHaveClass('top-[calc(4rem+env(safe-area-inset-top,0px))]');
    expect(toolbar).toHaveClass('translate-y-0');

    rerender(
      <StickyCatalogToolbar
        page={1}
        viewMode="grid"
        onViewModeChange={vi.fn()}
        onOpenFilters={vi.fn()}
        activeFilterCount={0}
        activeFilterChips={[]}
        onClearAllFilters={vi.fn()}
        isHeaderVisible={false}
      />
    );

    expect(toolbar).toHaveClass('top-[calc(4rem+env(safe-area-inset-top,0px))]');
    expect(toolbar).toHaveClass('-translate-y-16');
  });

  it('applies -translate-y-[calc(100%+4rem+env(safe-area-inset-top,0px))] and pointer-events-none when isVisible is false', () => {
    render(
      <StickyCatalogToolbar
        page={1}
        viewMode="grid"
        onViewModeChange={vi.fn()}
        onOpenFilters={vi.fn()}
        activeFilterCount={0}
        activeFilterChips={[]}
        onClearAllFilters={vi.fn()}
        isVisible={false}
      />
    );

    const toolbar = screen.getByTestId('sticky-catalog-toolbar');
    expect(toolbar).toHaveClass('-translate-y-[calc(100%+4rem+env(safe-area-inset-top,0px))]');
    expect(toolbar).toHaveClass('pointer-events-none');
  });

  it('renders archive fetching badge when isFetching is true and unifies telemetry into zero-CLS radar pill', () => {
    const { rerender } = render(
      <StickyCatalogToolbar
        page={8}
        onPageChange={vi.fn()}
        viewMode="grid"
        onViewModeChange={vi.fn()}
        onOpenFilters={vi.fn()}
        activeFilterCount={0}
        activeFilterChips={[]}
        onClearAllFilters={vi.fn()}
        isFetching={true}
        latencyMs={85}
        catalogSource="supabase"
      />
    );

    const badge = screen.getByTestId('archive-fetching-badge');
    expect(badge).toBeInTheDocument();
    expect(screen.getByTestId('api-latency-loading')).toHaveTextContent('•••');
    expect(screen.getByRole('status')).toHaveAttribute(
      'aria-label',
      'Fetching page 8 from archive. Hover or click for details.'
    );
    expect(screen.getByTestId('catalog-telemetry-popover')).toBeInTheDocument();
    expect(screen.getByText('Deep Archive Query')).toBeInTheDocument();
    expect(screen.getByText('Page 8')).toBeInTheDocument();

    rerender(
      <StickyCatalogToolbar
        page={8}
        onPageChange={vi.fn()}
        viewMode="grid"
        onViewModeChange={vi.fn()}
        onOpenFilters={vi.fn()}
        activeFilterCount={0}
        activeFilterChips={[]}
        onClearAllFilters={vi.fn()}
        isFetching={false}
        latencyMs={85}
        catalogSource="supabase"
      />
    );

    expect(screen.queryByTestId('archive-fetching-badge')).not.toBeInTheDocument();
    expect(screen.getByTestId('api-status-dot')).toBeInTheDocument();
    expect(screen.getByTestId('api-status-badge')).toHaveTextContent('85ms');
  });

  it('renders dual-service diagnostics in popover card across Supabase, Gutendex fallback, and offline states', () => {
    // 1. Supabase primary online
    const { rerender } = render(
      <StickyCatalogToolbar
        page={1}
        viewMode="grid"
        onViewModeChange={vi.fn()}
        onOpenFilters={vi.fn()}
        activeFilterCount={0}
        activeFilterChips={[]}
        onClearAllFilters={vi.fn()}
        latencyMs={42}
        catalogSource="supabase"
      />
    );

    expect(screen.getByText('Bookarium DB')).toBeInTheDocument();
    expect(screen.getByText('Gutendex API')).toBeInTheDocument();
    expect(screen.getByText('Online · 42ms')).toBeInTheDocument();
    expect(screen.getByText('Standby')).toBeInTheDocument();
    expect(screen.getByText(/Connected to dedicated Supabase PostgreSQL database/i)).toBeInTheDocument();

    // 2. Gutendex API active
    rerender(
      <StickyCatalogToolbar
        page={1}
        viewMode="grid"
        onViewModeChange={vi.fn()}
        onOpenFilters={vi.fn()}
        activeFilterCount={0}
        activeFilterChips={[]}
        onClearAllFilters={vi.fn()}
        latencyMs={240}
        catalogSource="upstream"
      />
    );

    expect(screen.getByText('Active · 240ms')).toBeInTheDocument();
    expect(screen.getByText('Standby / Unseeded')).toBeInTheDocument();
    expect(screen.getByText(/Serving public domain volumes via the upstream Gutendex REST mirror/i)).toBeInTheDocument();

    // 3. Offline / Error state
    rerender(
      <StickyCatalogToolbar
        page={1}
        viewMode="grid"
        onViewModeChange={vi.fn()}
        onOpenFilters={vi.fn()}
        activeFilterCount={0}
        activeFilterChips={[]}
        onClearAllFilters={vi.fn()}
        isError={true}
      />
    );

    expect(screen.getByText('Catalog Disconnected')).toBeInTheDocument();
    expect(screen.getAllByText('Offline').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/Network or service unavailable/i)).toBeInTheDocument();
  });

  it('dynamically flips popover orientation between downwards and upwards based on viewport clearance', () => {
    const originalInnerHeight = window.innerHeight;
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 800 });

    render(
      <StickyCatalogToolbar
        page={1}
        viewMode="grid"
        onViewModeChange={vi.fn()}
        onOpenFilters={vi.fn()}
        activeFilterCount={0}
        activeFilterChips={[]}
        onClearAllFilters={vi.fn()}
        latencyMs={42}
        catalogSource="supabase"
      />
    );

    const badge = screen.getByTestId('api-status-badge');
    const popover = screen.getByTestId('catalog-telemetry-popover');

    // 1. Scrolled to top: badge docked near bottom fold (top: 720, bottom: 760 -> spaceBelow = 40 < 232, spaceAbove = 720)
    vi.spyOn(badge, 'getBoundingClientRect').mockReturnValue({
      top: 720,
      bottom: 760,
      left: 600,
      right: 680,
      width: 80,
      height: 40,
      x: 600,
      y: 720,
      toJSON: () => {},
    });

    fireEvent.pointerEnter(badge);
    expect(popover).toHaveClass('bottom-full', 'mb-2', 'origin-bottom-right');
    expect(popover).not.toHaveClass('top-full', 'mt-2', 'origin-top-right');

    // 2. Scrolled down: toolbar stuck at top of viewport (top: 10, bottom: 50 -> spaceBelow = 750 >= 232, spaceAbove = 10)
    vi.spyOn(badge, 'getBoundingClientRect').mockReturnValue({
      top: 10,
      bottom: 50,
      left: 600,
      right: 680,
      width: 80,
      height: 40,
      x: 600,
      y: 10,
      toJSON: () => {},
    });

    fireEvent.pointerEnter(badge);
    expect(popover).toHaveClass('top-full', 'mt-2', 'origin-top-right');
    expect(popover).not.toHaveClass('bottom-full', 'mb-2', 'origin-bottom-right');

    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: originalInnerHeight });
  });

  it('supports touch tap toggling, outside-tap dismissal, and Escape key dismissal for telemetry popover', () => {
    render(
      <StickyCatalogToolbar
        page={1}
        viewMode="grid"
        onViewModeChange={vi.fn()}
        onOpenFilters={vi.fn()}
        activeFilterCount={0}
        activeFilterChips={[]}
        onClearAllFilters={vi.fn()}
        latencyMs={42}
        catalogSource="supabase"
      />
    );

    const badge = screen.getByTestId('api-status-badge');
    const popover = screen.getByTestId('catalog-telemetry-popover');

    // Initial state: not tapped open
    expect(popover).toHaveClass('pointer-events-none');
    expect(badge).toHaveAttribute('data-expanded', 'false');

    // Tap to open
    fireEvent.click(badge);
    expect(popover).toHaveClass('opacity-100', 'pointer-events-auto');
    expect(badge).toHaveAttribute('data-expanded', 'true');

    // Tap outside to close
    fireEvent.pointerDown(document.body);
    expect(popover).toHaveClass('pointer-events-none');
    expect(badge).toHaveAttribute('data-expanded', 'false');

    // Keyboard Enter to open
    fireEvent.keyDown(badge, { key: 'Enter' });
    expect(popover).toHaveClass('opacity-100', 'pointer-events-auto');
    expect(badge).toHaveAttribute('data-expanded', 'true');

    // Escape to close
    fireEvent.keyDown(badge, { key: 'Escape' });
    expect(popover).toHaveClass('pointer-events-none');
    expect(badge).toHaveAttribute('data-expanded', 'false');
  });

  it('renders direct page jump input without redundant Pg label', () => {
    render(
      <StickyCatalogToolbar
        page={3}
        onPageChange={vi.fn()}
        viewMode="grid"
        onViewModeChange={vi.fn()}
        onOpenFilters={vi.fn()}
        activeFilterCount={0}
        activeFilterChips={[]}
        onClearAllFilters={vi.fn()}
      />
    );

    expect(screen.getByLabelText('Jump to page')).toHaveValue('3');
    expect(screen.queryByText('Pg')).not.toBeInTheDocument();
  });

  describe('Mobile Floating Bottom Capsule Dock', () => {
    it('renders mobile dock with filter trigger, view mode switch, and scroll-to-top buttons', () => {
      render(
        <StickyCatalogToolbar
          page={1}
          viewMode="grid"
          onViewModeChange={vi.fn()}
          onOpenFilters={vi.fn()}
          activeFilterCount={3}
          activeFilterChips={[]}
          onClearAllFilters={vi.fn()}
        />
      );

      const dock = screen.getByTestId('mobile-catalog-dock');
      expect(dock).toBeInTheDocument();
      expect(dock).toHaveAttribute('aria-label', 'Mobile catalog controls');

      const filterBtn = screen.getByTestId('mobile-dock-filters-btn');
      expect(filterBtn).toBeInTheDocument();
      expect(filterBtn).toHaveAttribute('aria-label', 'Open filters');
      expect(filterBtn).toHaveTextContent('3');

      const viewModeBtn = screen.getByTestId('mobile-dock-view-mode-btn');
      expect(viewModeBtn).toBeInTheDocument();
      expect(viewModeBtn).toHaveAttribute('aria-label', 'Switch to bookshelf rack layout');
      expect(viewModeBtn).toHaveAttribute('aria-pressed', 'false');

      const topBtn = screen.getByTestId('mobile-dock-top-btn');
      expect(topBtn).toBeInTheDocument();
      expect(topBtn).toHaveAttribute('aria-label', 'Scroll to top');
    });

    it('handles mobile filter opening and view mode switching', () => {
      const handleOpenFilters = vi.fn();
      const handleViewModeChange = vi.fn();

      render(
        <StickyCatalogToolbar
          page={1}
          viewMode="grid"
          onViewModeChange={handleViewModeChange}
          onOpenFilters={handleOpenFilters}
          activeFilterCount={0}
          activeFilterChips={[]}
          onClearAllFilters={vi.fn()}
        />
      );

      fireEvent.click(screen.getByTestId('mobile-dock-filters-btn'));
      expect(handleOpenFilters).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByTestId('mobile-dock-view-mode-btn'));
      expect(handleViewModeChange).toHaveBeenCalledWith('shelf');
    });

    it('scrolls smoothly to top when mobile dock top button is clicked while scrolled, and mutes button when at top', () => {
      const scrollToSpy = vi.fn();
      vi.stubGlobal('scrollTo', scrollToSpy);
      Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true });

      render(
        <StickyCatalogToolbar
          page={1}
          viewMode="grid"
          onViewModeChange={vi.fn()}
          onOpenFilters={vi.fn()}
          activeFilterCount={0}
          activeFilterChips={[]}
          onClearAllFilters={vi.fn()}
        />
      );

      const topBtn = screen.getByTestId('mobile-dock-top-btn');
      expect(topBtn).toHaveAttribute('aria-disabled', 'true');
      expect(topBtn).toHaveClass('opacity-25', 'pointer-events-none');

      // Scroll down past 60px
      act(() => {
        window.scrollY = 250;
        window.dispatchEvent(new Event('scroll'));
      });

      expect(topBtn).not.toHaveClass('pointer-events-none');
      fireEvent.click(topBtn);
      expect(scrollToSpy).toHaveBeenCalledWith({
        top: 0,
        behavior: 'smooth',
      });

      vi.unstubAllGlobals();
    });

    it('controls mobile dock visibility with isMobileDockVisible prop', () => {
      const { rerender } = render(
        <StickyCatalogToolbar
          page={1}
          viewMode="grid"
          onViewModeChange={vi.fn()}
          onOpenFilters={vi.fn()}
          activeFilterCount={0}
          activeFilterChips={[]}
          onClearAllFilters={vi.fn()}
          isMobileDockVisible={true}
        />
      );

      const dock = screen.getByTestId('mobile-catalog-dock');
      expect(dock).toHaveClass('translate-y-0');

      rerender(
        <StickyCatalogToolbar
          page={1}
          viewMode="grid"
          onViewModeChange={vi.fn()}
          onOpenFilters={vi.fn()}
          activeFilterCount={0}
          activeFilterChips={[]}
          onClearAllFilters={vi.fn()}
          isMobileDockVisible={false}
        />
      );

      expect(dock).toHaveClass('translate-y-24');
      expect(dock).toHaveClass('opacity-0');
      expect(dock).toHaveClass('pointer-events-none');
    });

    it('keeps mobile dock docked at translate-y-0, resting dimmed at top and waking on scroll', () => {
      Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true });

      render(
        <StickyCatalogToolbar
          page={1}
          viewMode="grid"
          onViewModeChange={vi.fn()}
          onOpenFilters={vi.fn()}
          activeFilterCount={0}
          activeFilterChips={[]}
          onClearAllFilters={vi.fn()}
          mobileDockThreshold={300}
        />
      );

      const dock = screen.getByTestId('mobile-catalog-dock');
      // Initially at top (scrollY = 0): docked in resting dimmed state (opacity-30)
      expect(dock).toHaveClass('translate-y-0');
      expect(dock).toHaveClass('opacity-30');

      // Scroll past hero into catalog (scrollY = 450)
      act(() => {
        window.scrollY = 450;
        window.dispatchEvent(new Event('scroll'));
      });

      expect(dock).toHaveClass('translate-y-0');
      expect(dock).toHaveClass('opacity-100');

      // Return to top hero section (scrollY = 0)
      act(() => {
        window.scrollY = 0;
        window.dispatchEvent(new Event('scroll'));
      });

      expect(dock).toHaveClass('translate-y-0');
      expect(dock).toHaveClass('opacity-30');
    });

    it('renders ambient light aura and multi-stop dark/sepia shadows for mobile dock', () => {
      render(
        <StickyCatalogToolbar
          page={1}
          viewMode="grid"
          onViewModeChange={vi.fn()}
          onOpenFilters={vi.fn()}
          activeFilterCount={0}
          activeFilterChips={[]}
          onClearAllFilters={vi.fn()}
        />
      );

      const aura = screen.getByTestId('mobile-dock-ambient-aura');
      expect(aura).toBeInTheDocument();
      expect(aura).toHaveClass('-inset-1.5', 'blur-md', 'rounded-full');
    });

    it('dims to opacity-30 after scroll inactivity timeout', () => {
      vi.useFakeTimers();
      Object.defineProperty(window, 'scrollY', { value: 0, writable: true });

      render(
        <StickyCatalogToolbar
          page={1}
          viewMode="grid"
          onViewModeChange={vi.fn()}
          onOpenFilters={vi.fn()}
          activeFilterCount={0}
          activeFilterChips={[]}
          onClearAllFilters={vi.fn()}
          mobileDockThreshold={300}
        />
      );

      const dock = screen.getByTestId('mobile-catalog-dock');

      // Scroll into catalog
      act(() => {
        window.scrollY = 500;
        window.dispatchEvent(new Event('scroll'));
      });

      // Actively scrolling: visible with opacity-100
      expect(dock).toHaveClass('translate-y-0');
      expect(dock).toHaveClass('opacity-100');
      expect(dock).not.toHaveClass('pointer-events-none');

      // Advance by 1300ms (not yet idle under default 1400ms)
      act(() => {
        vi.advanceTimersByTime(1300);
      });
      expect(dock).toHaveClass('opacity-100');

      // Advance past 1400ms -> dims to opacity-30 (hover:opacity-100) instead of opacity-0
      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(dock).toHaveClass('opacity-30');
      expect(dock).not.toHaveClass('pointer-events-none');

      // Resume scrolling: instantly wakes back up
      act(() => {
        window.scrollY = 550;
        window.dispatchEvent(new Event('scroll'));
      });
      expect(dock).toHaveClass('opacity-100');
      expect(dock).not.toHaveClass('pointer-events-none');

      vi.useRealTimers();
    });

    it('does not fade out mobile dock after idle timeout if filter drawer is open', () => {
      vi.useFakeTimers();
      Object.defineProperty(window, 'scrollY', { value: 500, writable: true });

      render(
        <StickyCatalogToolbar
          page={1}
          viewMode="grid"
          onViewModeChange={vi.fn()}
          onOpenFilters={vi.fn()}
          isFiltersOpen={true}
          activeFilterCount={0}
          activeFilterChips={[]}
          onClearAllFilters={vi.fn()}
          mobileDockThreshold={300}
        />
      );

      const dock = screen.getByTestId('mobile-catalog-dock');
      act(() => {
        window.dispatchEvent(new Event('scroll'));
      });
      expect(dock).toHaveClass('opacity-100');

      // Advance past default 1400ms
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // Filter drawer is open -> remains visible
      expect(dock).toHaveClass('opacity-100');
      expect(dock).not.toHaveClass('pointer-events-none');

      vi.useRealTimers();
    });

    it('cancels idle dimming while user hovers over dock and resumes timer on pointerleave', () => {
      vi.useFakeTimers();
      Object.defineProperty(window, 'scrollY', { value: 500, writable: true });

      render(
        <StickyCatalogToolbar
          page={1}
          viewMode="grid"
          onViewModeChange={vi.fn()}
          onOpenFilters={vi.fn()}
          activeFilterCount={0}
          activeFilterChips={[]}
          onClearAllFilters={vi.fn()}
          mobileDockThreshold={300}
        />
      );

      const dock = screen.getByTestId('mobile-catalog-dock');
      act(() => {
        window.dispatchEvent(new Event('scroll'));
      });

      // Hover over dock before timeout
      fireEvent.pointerEnter(dock);

      // Advance past default 1400ms while hovered
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(dock).toHaveClass('opacity-100');

      // Pointer leaves dock -> timer restarts
      fireEvent.pointerLeave(dock);
      expect(dock).toHaveClass('opacity-100');

      act(() => {
        vi.advanceTimersByTime(1500);
      });
      expect(dock).toHaveClass('opacity-30');

      // Pointer down / touch wakes it up
      fireEvent.pointerDown(dock);
      expect(dock).toHaveClass('opacity-100');

      vi.useRealTimers();
    });

    it('renders circular filter button with absolute counter badge on mobile dock when filters are active', () => {
      const handleOpenFilters = vi.fn();

      render(
        <StickyCatalogToolbar
          page={1}
          viewMode="grid"
          onViewModeChange={vi.fn()}
          onOpenFilters={handleOpenFilters}
          activeFilterCount={3}
          activeFilterChips={[
            { id: 'era', label: 'Victorian', onRemove: vi.fn() },
            { id: 'topic', label: 'Philosophy', onRemove: vi.fn() },
            { id: 'lang', label: 'French', onRemove: vi.fn() },
          ]}
          onClearAllFilters={vi.fn()}
          isMobileDockVisible={true}
        />
      );

      const filtersBtn = screen.getByTestId('mobile-dock-filters-btn');
      expect(filtersBtn).toBeInTheDocument();
      expect(filtersBtn).toHaveClass('w-8', 'h-8', 'rounded-full');

      const badge = screen.getByTestId('mobile-dock-filters-badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('3');

      fireEvent.click(filtersBtn);
      expect(handleOpenFilters).toHaveBeenCalledTimes(1);
    });

    it('renders search trigger on mobile dock and handles toggle clicks', () => {
      const handleSearchToggle = vi.fn();

      render(
        <StickyCatalogToolbar
          page={1}
          viewMode="grid"
          onViewModeChange={vi.fn()}
          onOpenFilters={vi.fn()}
          activeFilterCount={0}
          activeFilterChips={[]}
          onClearAllFilters={vi.fn()}
          isMobileDockVisible={true}
          isSearchOpen={false}
          onSearchToggle={handleSearchToggle}
          searchQuery="Austen"
        />
      );

      const searchBtn = screen.getByTestId('mobile-dock-search-btn');
      expect(searchBtn).toBeInTheDocument();
      expect(searchBtn).toHaveClass('w-8', 'h-8', 'rounded-full');
      expect(searchBtn).toHaveAttribute('aria-label', 'Search catalog');

      fireEvent.click(searchBtn);
      expect(handleSearchToggle).toHaveBeenCalledTimes(1);
    });
  });

  describe('Segmented Split-Button Quick Clear', () => {
    it('renders segmented quick clear button on desktop toolbar when filters are active and clears filters on click', () => {
      const handleOpenFilters = vi.fn();
      const handleClearAll = vi.fn();

      render(
        <StickyCatalogToolbar
          page={1}
          viewMode="grid"
          onViewModeChange={vi.fn()}
          onOpenFilters={handleOpenFilters}
          activeFilterCount={2}
          activeFilterChips={[
            { id: 'era', label: 'Victorian', onRemove: vi.fn() },
            { id: 'lang', label: 'French', onRemove: vi.fn() },
          ]}
          onClearAllFilters={handleClearAll}
        />
      );

      const clearBtn = screen.getByTestId('clear-all-filters-btn');
      expect(clearBtn).toBeInTheDocument();
      expect(clearBtn).toHaveAttribute('aria-label', 'Clear all 2 active filters');
      expect(screen.getByTestId('open-filters-btn')).toHaveAttribute('title', 'Open advanced filters');
      expect(screen.getByRole('button', { name: 'Remove filter Victorian' })).toHaveAttribute(
        'title',
        'Remove filter: Victorian'
      );

      fireEvent.click(clearBtn);
      expect(handleClearAll).toHaveBeenCalledTimes(1);
      expect(handleOpenFilters).not.toHaveBeenCalled();
    });

    it('does not render quick clear buttons on desktop or mobile when activeFilterCount is 0', () => {
      render(
        <StickyCatalogToolbar
          page={1}
          viewMode="grid"
          onViewModeChange={vi.fn()}
          onOpenFilters={vi.fn()}
          activeFilterCount={0}
          activeFilterChips={[]}
          onClearAllFilters={vi.fn()}
          isMobileDockVisible={true}
        />
      );

      expect(screen.queryByTestId('clear-all-filters-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('mobile-dock-clear-all-btn')).not.toBeInTheDocument();
    });

    it('enforces mutually exclusive responsive breakpoint isolation and border-y between desktop and mobile bars', () => {
      render(
        <StickyCatalogToolbar
          page={1}
          viewMode="grid"
          onViewModeChange={vi.fn()}
          onOpenFilters={vi.fn()}
          activeFilterCount={0}
          activeFilterChips={[]}
          onClearAllFilters={vi.fn()}
          isMobileDockVisible={true}
        />
      );

      const desktopToolbar = screen.getByTestId('sticky-catalog-toolbar');
      const mobileDock = screen.getByTestId('mobile-catalog-dock');

      // Desktop toolbar: hidden on mobile (< 640px), block on tablet & desktop (>= 640px)
      expect(desktopToolbar).toHaveClass('hidden', 'sm:block');
      // Desktop toolbar must have border-y to ensure the bottom flush border is rendered when undocked
      expect(desktopToolbar).toHaveClass('border-y', 'border-border');

      // Floating capsule dock: universal across mobile, tablet, and desktop viewports
      expect(mobileDock).not.toHaveClass('lg:hidden');
    });

    it('collapses top border to border-b when isDocked and isHeaderVisible are both true to prevent a 2px double-border seam under Navbar', () => {
      const { rerender } = render(
        <StickyCatalogToolbar
          page={1}
          viewMode="grid"
          onViewModeChange={vi.fn()}
          onOpenFilters={vi.fn()}
          activeFilterCount={0}
          activeFilterChips={[]}
          onClearAllFilters={vi.fn()}
          isDocked={true}
          isHeaderVisible={true}
        />
      );

      const desktopToolbar = screen.getByTestId('sticky-catalog-toolbar');
      expect(desktopToolbar).toHaveClass('border-b', 'border-border');
      expect(desktopToolbar).not.toHaveClass('border-y');

      // When header hides while docked, border-y is restored
      rerender(
        <StickyCatalogToolbar
          page={1}
          viewMode="grid"
          onViewModeChange={vi.fn()}
          onOpenFilters={vi.fn()}
          activeFilterCount={0}
          activeFilterChips={[]}
          onClearAllFilters={vi.fn()}
          isDocked={true}
          isHeaderVisible={false}
        />
      );
      expect(desktopToolbar).toHaveClass('border-y', 'border-border');
    });

    it('renders mobile dock sort toggle button and invokes onSortToggle on click', () => {
      const onSortToggle = vi.fn();
      const { rerender } = render(
        <StickyCatalogToolbar
          page={1}
          viewMode="grid"
          onViewModeChange={vi.fn()}
          onOpenFilters={vi.fn()}
          activeFilterCount={0}
          activeFilterChips={[]}
          onClearAllFilters={vi.fn()}
          isMobileDockVisible={true}
          currentSort="descending"
          onSortToggle={onSortToggle}
        />
      );

      const sortBtn = screen.getByTestId('mobile-dock-sort-toggle-btn');
      expect(sortBtn).toBeInTheDocument();
      expect(sortBtn).toHaveAttribute('aria-label', 'Switch to most popular books');

      fireEvent.click(sortBtn);
      expect(onSortToggle).toHaveBeenCalledTimes(1);

      rerender(
        <StickyCatalogToolbar
          page={1}
          viewMode="grid"
          onViewModeChange={vi.fn()}
          onOpenFilters={vi.fn()}
          activeFilterCount={0}
          activeFilterChips={[]}
          onClearAllFilters={vi.fn()}
          isMobileDockVisible={true}
          currentSort="popular"
          onSortToggle={onSortToggle}
        />
      );

      expect(sortBtn).toHaveAttribute('aria-label', 'Switch to most recent releases');
      expect(sortBtn).toHaveClass('bg-amber-500/10');
    });
  });
});

