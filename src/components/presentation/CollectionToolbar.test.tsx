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
});
