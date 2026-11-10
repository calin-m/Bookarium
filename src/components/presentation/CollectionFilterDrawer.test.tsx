import React from 'react';
import { render, screen, fireEvent, createEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CollectionFilterDrawer } from './CollectionFilterDrawer';

describe('CollectionFilterDrawer', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    title: 'Bookshelf Filters & Sort',
    activeFilterCount: 2,
    shelfOptions: [
      { id: 'all', label: 'All Shelves', count: 12 },
      { id: 'reading', label: 'Currently Reading', count: 3 },
      { id: 'read', label: 'Finished', count: 9 },
    ],
    selectedShelfId: 'reading',
    onSelectShelf: vi.fn(),
    sortOptions: [
      { value: 'recent', label: 'Recently Added' },
      { value: 'title', label: 'Title (A → Z)' },
    ],
    selectedSort: 'recent',
    onSortChange: vi.fn(),
    sortDirection: 'asc' as const,
    onDirectionToggle: vi.fn(),
    onResetAll: vi.fn(),
    onApply: vi.fn(),
  };

  it('renders nothing when isOpen is false', () => {
    render(<CollectionFilterDrawer {...defaultProps} isOpen={false} />);
    expect(screen.queryByTestId('collection-filter-drawer')).not.toBeInTheDocument();
  });

  it('renders title, badge count, and all filter sections when isOpen is true', () => {
    render(<CollectionFilterDrawer {...defaultProps} />);

    expect(screen.getByText('Bookshelf Filters & Sort')).toBeInTheDocument();
    expect(screen.getByText('2 active filters')).toBeInTheDocument();
    expect(screen.getByTestId('collection-filter-drawer-backdrop')).toHaveClass('bg-black/60', 'touch-none');
    expect(screen.getByTestId('filter-shelf-all')).toBeInTheDocument();
    expect(screen.getByTestId('filter-shelf-reading')).toBeInTheDocument();
    expect(screen.getByTestId('filter-sort-recent')).toBeInTheDocument();
    expect(screen.getByTestId('filter-direction-asc-btn')).toBeInTheDocument();
  });

  it('handles shelf selection when an option is clicked', () => {
    const handleSelectShelf = vi.fn();
    render(<CollectionFilterDrawer {...defaultProps} onSelectShelf={handleSelectShelf} />);

    fireEvent.click(screen.getByTestId('filter-shelf-read'));
    expect(handleSelectShelf).toHaveBeenCalledWith('read');
  });

  it('handles sort selection when a sort chip is clicked', () => {
    const handleSortChange = vi.fn();
    render(<CollectionFilterDrawer {...defaultProps} onSortChange={handleSortChange} />);

    fireEvent.click(screen.getByTestId('filter-sort-title'));
    expect(handleSortChange).toHaveBeenCalledWith('title');
  });

  it('handles direction toggling', () => {
    const handleDirectionToggle = vi.fn();
    render(<CollectionFilterDrawer {...defaultProps} onDirectionToggle={handleDirectionToggle} />);

    fireEvent.click(screen.getByTestId('filter-direction-desc-btn'));
    expect(handleDirectionToggle).toHaveBeenCalledTimes(1);
  });

  it('handles view mode selection when viewMode is provided', () => {
    const handleViewModeChange = vi.fn();
    render(
      <CollectionFilterDrawer
        {...defaultProps}
        viewMode="book"
        onViewModeChange={handleViewModeChange}
      />
    );

    fireEvent.click(screen.getByTestId('filter-viewmode-chrono-btn'));
    expect(handleViewModeChange).toHaveBeenCalledWith('chronological');
  });

  it('triggers onResetAll when Reset All button is clicked', () => {
    const handleResetAll = vi.fn();
    render(<CollectionFilterDrawer {...defaultProps} onResetAll={handleResetAll} />);

    fireEvent.click(screen.getByTestId('collection-filter-reset-btn'));
    expect(handleResetAll).toHaveBeenCalledTimes(1);
  });

  it('triggers onApply and closes drawer when Apply button is clicked', () => {
    const handleApply = vi.fn();
    const handleClose = vi.fn();
    render(
      <CollectionFilterDrawer
        {...defaultProps}
        onApply={handleApply}
        onClose={handleClose}
      />
    );

    fireEvent.click(screen.getByTestId('collection-filter-apply-btn'));
    expect(handleApply).toHaveBeenCalledTimes(1);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('dismisses when backdrop or close button is clicked', () => {
    const handleClose = vi.fn();
    render(<CollectionFilterDrawer {...defaultProps} onClose={handleClose} />);

    fireEvent.click(screen.getByTestId('collection-filter-drawer-close-btn'));
    expect(handleClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('collection-filter-drawer-backdrop'));
    expect(handleClose).toHaveBeenCalledTimes(2);
  });

  it('dismisses when Escape key is pressed', () => {
    const handleClose = vi.fn();
    render(<CollectionFilterDrawer {...defaultProps} onClose={handleClose} />);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('renders strictly agnostic Ascending and Descending direction labels', () => {
    render(<CollectionFilterDrawer {...defaultProps} />);

    const ascBtn = screen.getByTestId('filter-direction-asc-btn');
    const descBtn = screen.getByTestId('filter-direction-desc-btn');

    expect(ascBtn).toHaveTextContent('Ascending');
    expect(ascBtn).not.toHaveTextContent('A → Z');
    expect(descBtn).toHaveTextContent('Descending');
    expect(descBtn).not.toHaveTextContent('Z → A');
  });

  it('never locks body overflow across mobile, tablet, and desktop viewports for zero CLS', () => {
    for (const width of [375, 768, 1024, 1440]) {
      const originalInnerWidth = window.innerWidth;
      Object.defineProperty(window, 'innerWidth', { value: width, writable: true, configurable: true });
      document.body.style.overflow = '';

      const { unmount } = render(<CollectionFilterDrawer {...defaultProps} isOpen={true} />);
      expect(document.body.style.overflow).toBe('');

      unmount();
      expect(document.body.style.overflow).toBe('');
      Object.defineProperty(window, 'innerWidth', { value: originalInnerWidth, writable: true, configurable: true });
    }
  });

  it('intercepts touchmove and wheel on backdrop with preventDefault to eliminate background scroll bleed', () => {
    render(<CollectionFilterDrawer {...defaultProps} isOpen={true} />);
    const backdrop = screen.getByTestId('collection-filter-drawer-backdrop');

    const touchMoveEvent = createEvent.touchMove(backdrop);
    const preventTouchDefault = vi.spyOn(touchMoveEvent, 'preventDefault');
    fireEvent(backdrop, touchMoveEvent);
    expect(preventTouchDefault).toHaveBeenCalled();

    const wheelEvent = createEvent.wheel(backdrop);
    const preventWheelDefault = vi.spyOn(wheelEvent, 'preventDefault');
    fireEvent(backdrop, wheelEvent);
    expect(preventWheelDefault).toHaveBeenCalled();
  });

  it('renders outer drawer wrapper with overflow-hidden and contain:strict for GPU isolation', () => {
    render(<CollectionFilterDrawer {...defaultProps} isOpen={true} />);
    const drawer = screen.getByTestId('collection-filter-drawer');
    expect(drawer).toHaveClass('overflow-hidden', '[contain:strict]');
  });

  it('hides sort direction when isDirectionDisabled is true and renders when enabled', () => {
    const { rerender } = render(
      <CollectionFilterDrawer {...defaultProps} isDirectionDisabled={true} />
    );

    expect(screen.queryByTestId('filter-direction-asc-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('filter-direction-desc-btn')).not.toBeInTheDocument();

    rerender(<CollectionFilterDrawer {...defaultProps} isDirectionDisabled={false} />);

    expect(screen.getByTestId('filter-direction-asc-btn')).toBeInTheDocument();
    expect(screen.getByTestId('filter-direction-desc-btn')).toBeInTheDocument();
  });
});
