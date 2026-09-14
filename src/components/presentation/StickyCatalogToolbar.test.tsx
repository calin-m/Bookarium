import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { StickyCatalogToolbar } from './StickyCatalogToolbar';

describe('StickyCatalogToolbar component', () => {
  it('should render filter trigger, active chips, and 2-part API status badge', () => {
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
    expect(screen.getByTestId('api-status-badge')).toHaveTextContent('Live');
    expect(screen.getByTestId('api-latency-badge')).toHaveTextContent('85ms');
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
    expect(toolbar).toHaveClass('top-16');
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

    expect(toolbar).toHaveClass('top-16');
    expect(toolbar).toHaveClass('-translate-y-16');
  });

  it('applies -translate-y-[calc(100%+4rem)] and pointer-events-none when isVisible is false', () => {
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
    expect(toolbar).toHaveClass('-translate-y-[calc(100%+4rem)]');
    expect(toolbar).toHaveClass('pointer-events-none');
  });

  it('renders archive fetching badge when isFetching is true', () => {
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
      />
    );

    const badge = screen.getByTestId('archive-fetching-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('Fetching Pg 8...');
    expect(screen.getByRole('status')).toHaveAttribute(
      'aria-label',
      'Fetching page 8 from archive. Hover or click for details.'
    );

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
      />
    );

    expect(screen.queryByTestId('archive-fetching-badge')).not.toBeInTheDocument();
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

      const gridBtn = screen.getByTestId('mobile-dock-grid-btn');
      const shelfBtn = screen.getByTestId('mobile-dock-shelf-btn');
      expect(gridBtn).toBeInTheDocument();
      expect(gridBtn).toHaveAttribute('aria-pressed', 'true');
      expect(shelfBtn).toBeInTheDocument();
      expect(shelfBtn).toHaveAttribute('aria-pressed', 'false');

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

      fireEvent.click(screen.getByTestId('mobile-dock-shelf-btn'));
      expect(handleViewModeChange).toHaveBeenCalledWith('shelf');

      fireEvent.click(screen.getByTestId('mobile-dock-grid-btn'));
      expect(handleViewModeChange).toHaveBeenCalledWith('grid');
    });

    it('scrolls smoothly to top when mobile dock top button is clicked', () => {
      const scrollToSpy = vi.fn();
      vi.stubGlobal('scrollTo', scrollToSpy);

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

      fireEvent.click(screen.getByTestId('mobile-dock-top-btn'));
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
      expect(dock).toHaveClass('opacity-100');

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

    it('dynamically reveals mobile dock when scrolling past threshold and hides when at top', () => {
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
      // Initially at top (scrollY = 0 <= 300)
      expect(dock).toHaveClass('translate-y-24');
      expect(dock).toHaveClass('opacity-0');

      // Scroll past hero into catalog (scrollY = 450 > 300)
      act(() => {
        window.scrollY = 450;
        window.dispatchEvent(new Event('scroll'));
      });

      expect(dock).toHaveClass('translate-y-0');
      expect(dock).toHaveClass('opacity-100');

      // Return to top hero section (scrollY = 100 <= 300)
      act(() => {
        window.scrollY = 100;
        window.dispatchEvent(new Event('scroll'));
      });

      expect(dock).toHaveClass('translate-y-24');
      expect(dock).toHaveClass('opacity-0');
    });
  });
});
