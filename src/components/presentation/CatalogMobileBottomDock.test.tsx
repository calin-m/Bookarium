import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CatalogMobileBottomDock } from './CatalogMobileBottomDock';

describe('CatalogMobileBottomDock', () => {
  it('triggers search toggle, filter drawer, view mode switch, and sort toggle', () => {
    const onSearchToggle = vi.fn();
    const onOpenFilters = vi.fn();
    const onViewModeChange = vi.fn();
    const onSortToggle = vi.fn();

    render(
      <CatalogMobileBottomDock
        isMobileDockVisible={true}
        isSearchOpen={false}
        onSearchToggle={onSearchToggle}
        searchQuery="Austen"
        isFiltersOpen={false}
        onOpenFilters={onOpenFilters}
        activeFilterCount={2}
        viewMode="grid"
        onViewModeChange={onViewModeChange}
        currentSort="popular"
        onSortToggle={onSortToggle}
      />
    );

    expect(screen.getByTestId('mobile-catalog-dock')).toBeInTheDocument();
    expect(screen.getByTestId('mobile-dock-filters-badge')).toHaveTextContent(
      '2'
    );

    fireEvent.click(screen.getByTestId('mobile-dock-search-btn'));
    expect(onSearchToggle).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('mobile-dock-filters-btn'));
    expect(onOpenFilters).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('mobile-dock-view-mode-btn'));
    expect(onViewModeChange).toHaveBeenCalledWith('shelf');

    fireEvent.click(screen.getByTestId('mobile-dock-sort-toggle-btn'));
    expect(onSortToggle).toHaveBeenCalledTimes(1);
  });
});
