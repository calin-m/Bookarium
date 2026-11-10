import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CollectionToolbar } from './CollectionToolbar';
import type { SortOption } from './CollectionSortDropdown';

describe('CollectionToolbar', () => {
  const sortOptions: SortOption[] = [
    { value: 'recent', label: 'Recently Added' },
    { value: 'title_asc', label: 'Title (A → Z)' },
    { value: 'author_asc', label: 'Author (A → Z)' },
  ];

  it('renders search input with placeholder and accessible label', () => {
    render(
      <CollectionToolbar
        searchQuery=""
        onSearchChange={vi.fn()}
        searchPlaceholder="Search collection..."
        searchAriaLabel="Search bookshelf"
      />
    );

    const input = screen.getByRole('textbox', { name: 'Search bookshelf' });
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('placeholder', 'Search collection...');
  });

  it('calls onSearchChange when user types in search input', () => {
    const onSearchChange = vi.fn();
    render(
      <CollectionToolbar
        searchQuery=""
        onSearchChange={onSearchChange}
        searchPlaceholder="Search..."
      />
    );

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Jane Austen' } });

    expect(onSearchChange).toHaveBeenCalledWith('Jane Austen');
  });

  it('renders clear button and counter badge when filtering', () => {
    const onSearchChange = vi.fn();
    render(
      <CollectionToolbar
        searchQuery="Austen"
        onSearchChange={onSearchChange}
        totalCount={20}
        filteredCount={4}
        searchAriaLabel="Search library"
      />
    );

    expect(screen.getByText('4 / 20')).toBeInTheDocument();
    const clearBtn = screen.getByRole('button', { name: 'Clear search' });
    expect(clearBtn).toBeInTheDocument();

    fireEvent.click(clearBtn);
    expect(onSearchChange).toHaveBeenCalledWith('');
  });

  it('supports custom clearAriaLabel', () => {
    render(
      <CollectionToolbar
        searchQuery="Austen"
        onSearchChange={vi.fn()}
        clearAriaLabel="Clear library search"
      />
    );
    expect(screen.getByRole('button', { name: 'Clear library search' })).toBeInTheDocument();
  });

  it('clears search when pressing Escape key', () => {
    const onSearchChange = vi.fn();
    render(
      <CollectionToolbar
        searchQuery="Dostoevsky"
        onSearchChange={onSearchChange}
      />
    );

    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onSearchChange).toHaveBeenCalledWith('');
  });

  it('renders sort dropdown and handles value changes', () => {
    const onSortChange = vi.fn();
    render(
      <CollectionToolbar
        searchQuery=""
        onSearchChange={vi.fn()}
        sortValue="recent"
        onSortChange={onSortChange}
        sortOptions={sortOptions}
        sortAriaLabel="Sort collection"
      />
    );

    const select = screen.getByRole('combobox', { name: 'Sort collection' });
    expect(select).toBeInTheDocument();
    expect(select).toHaveValue('recent');

    const dropdown = screen.getByTestId('collection-sort-dropdown');
    expect(dropdown).toHaveClass('min-w-[125px]', 'max-w-[170px]', 'sm:max-w-[195px]');
    expect(dropdown.parentElement).toHaveClass('w-auto', 'shrink-0', 'min-w-0');

    fireEvent.change(select, { target: { value: 'title_asc' } });
    expect(onSortChange).toHaveBeenCalledWith('title_asc');
  });

  it('renders top pagination when totalPages > 1 and handles page clicks', () => {
    const onPageChange = vi.fn();
    render(
      <CollectionToolbar
        searchQuery=""
        onSearchChange={vi.fn()}
        currentPage={1}
        totalPages={3}
        onPageChange={onPageChange}
        paginationAriaLabel="Top collection pagination"
      />
    );

    const nav = screen.getByRole('navigation', { name: 'Top collection pagination' });
    expect(nav).toBeInTheDocument();
    expect(within(nav).getByTestId('top-pagination-indicator')).toHaveTextContent(/1\s*\/\s*3/);

    const nextBtn = within(nav).getByRole('button', { name: 'Next page' });
    fireEvent.click(nextBtn);

    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('does not render top pagination when totalPages <= 1', () => {
    render(
      <CollectionToolbar
        searchQuery=""
        onSearchChange={vi.fn()}
        currentPage={1}
        totalPages={1}
        onPageChange={vi.fn()}
      />
    );

    expect(screen.queryByTestId('collection-top-pagination')).not.toBeInTheDocument();
  });

  it('renders item count label and extra controls when provided', () => {
    render(
      <CollectionToolbar
        searchQuery=""
        onSearchChange={vi.fn()}
        itemCountLabel="18 volumes"
        extraControls={<div data-testid="custom-mode-toggle">Mode Toggle</div>}
      />
    );

    expect(screen.getByTestId('collection-item-count')).toHaveTextContent('18 volumes');
    expect(screen.getByTestId('custom-mode-toggle')).toBeInTheDocument();
  });

  it('renders status filter dropdown and handles value changes when filterOptions provided', () => {
    const onFilterChange = vi.fn();
    const filterOptions: SortOption[] = [
      { value: 'all', label: 'All Volumes (10)' },
      { value: 'in_progress', label: 'In Progress (3)' },
      { value: 'completed', label: 'Completed (5)' },
    ];

    render(
      <CollectionToolbar
        searchQuery=""
        onSearchChange={vi.fn()}
        filterValue="all"
        onFilterChange={onFilterChange}
        filterOptions={filterOptions}
        filterAriaLabel="Filter collection status"
      />
    );

    expect(screen.getByTestId('collection-filter-dropdown')).toBeInTheDocument();
    const select = screen.getByRole('combobox', { name: 'Filter collection status' });
    expect(select).toBeInTheDocument();
    expect(select).toHaveValue('all');
    expect(select).toHaveClass('pl-2.5', 'sm:pl-3');

    fireEvent.change(select, { target: { value: 'in_progress' } });
    expect(onFilterChange).toHaveBeenCalledWith('in_progress');
  });

  it('passes sort direction props down to sort dropdown', () => {
    const onDirectionToggle = vi.fn();
    render(
      <CollectionToolbar
        searchQuery=""
        onSearchChange={vi.fn()}
        sortValue="title"
        onSortChange={vi.fn()}
        sortOptions={sortOptions}
        sortDirection="asc"
        onDirectionToggle={onDirectionToggle}
        directionAriaLabel="Sort Ascending"
      />
    );

    const dirBtn = screen.getByTestId('collection-sort-direction-btn');
    expect(dirBtn).toBeInTheDocument();
    expect(dirBtn).toHaveAttribute('aria-label', 'Sort Ascending');

    fireEvent.click(dirBtn);
    expect(onDirectionToggle).toHaveBeenCalledTimes(1);
  });

  it('applies adaptive single-row layout (sm:flex-row) when only one control is present (Bookshelf/Favorites Option A)', () => {
    render(
      <CollectionToolbar
        searchQuery=""
        onSearchChange={vi.fn()}
        sortValue="recent"
        onSortChange={vi.fn()}
        sortOptions={sortOptions}
      />
    );

    const toolbar = screen.getByTestId('collection-toolbar');
    expect(toolbar).toHaveClass('sm:flex-row', 'sm:items-center');
  });

  it('applies two-handed tactile layout (justify-between md:justify-end) and md:flex-row when multiple controls are present (Bookmarks/Notebook)', () => {
    const filterOptions: SortOption[] = [
      { value: 'all', label: 'All Volumes (10)' },
      { value: 'in_progress', label: 'In Progress (3)' },
    ];

    render(
      <CollectionToolbar
        searchQuery=""
        onSearchChange={vi.fn()}
        filterValue="all"
        onFilterChange={vi.fn()}
        filterOptions={filterOptions}
        sortValue="title"
        onSortChange={vi.fn()}
        sortOptions={sortOptions}
        sortDirection="asc"
        onDirectionToggle={vi.fn()}
      />
    );

    const toolbar = screen.getByTestId('collection-toolbar');
    expect(toolbar).toHaveClass('md:flex-row', 'md:items-center');

    const filterDropdown = screen.getByTestId('collection-filter-dropdown');
    const sortDropdown = screen.getByTestId('collection-sort-dropdown');

    // Left group sits in a justify-start wrapper, Right group sits in a justify-end wrapper
    expect(filterDropdown.parentElement).toHaveClass('justify-start');
    expect(sortDropdown.parentElement).toHaveClass('justify-end');

    // Row 2 utility container uses justify-between on narrow/stacked viewports and md:justify-end on desktop
    const utilityRow = filterDropdown.parentElement?.parentElement;
    expect(utilityRow).toHaveClass('justify-between', 'md:justify-end');
  });

  it('enforces single-row mobile layout and propagates compactOnMobile to sort dropdown when singleRowOnMobile is true', () => {
    render(
      <CollectionToolbar
        searchQuery=""
        onSearchChange={vi.fn()}
        sortValue="recent"
        onSortChange={vi.fn()}
        sortOptions={sortOptions}
        singleRowOnMobile={true}
      />
    );

    const toolbar = screen.getByTestId('collection-toolbar');
    expect(toolbar).toHaveClass('flex-row', 'items-center', 'justify-between');
    expect(toolbar).not.toHaveClass('flex-col');

    const sortDropdown = screen.getByTestId('collection-sort-dropdown');
    expect(sortDropdown).toHaveClass('w-auto');

    const compactTrigger = within(sortDropdown).getByTestId('compact-sort-trigger');
    expect(compactTrigger).toHaveClass('w-8', 'h-8');
  });

  it('applies hidden sm:flex to root toolbar when hiddenOnMobile is true', () => {
    render(
      <CollectionToolbar
        searchQuery=""
        onSearchChange={vi.fn()}
        hiddenOnMobile={true}
      />
    );

    const toolbar = screen.getByTestId('collection-toolbar');
    expect(toolbar).toHaveClass('hidden', 'sm:flex');

    // Search container itself remains intact inside toolbar
    const searchContainer = screen.getByTestId('collection-toolbar-search-container');
    expect(searchContainer).not.toHaveClass('hidden');
  });

  it('keeps toolbar flex visible across all breakpoints when hiddenOnMobile is omitted', () => {
    render(
      <CollectionToolbar
        searchQuery=""
        onSearchChange={vi.fn()}
      />
    );

    const toolbar = screen.getByTestId('collection-toolbar');
    expect(toolbar).toHaveClass('flex');
    expect(toolbar).not.toHaveClass('hidden');
  });
});
