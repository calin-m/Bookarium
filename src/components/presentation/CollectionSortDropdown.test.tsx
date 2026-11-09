import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CollectionSortDropdown, type SortOption } from './CollectionSortDropdown';

describe('CollectionSortDropdown', () => {
  const options: SortOption[] = [
    { value: 'recent', label: 'Recently Read' },
    { value: 'title_asc', label: 'Title (A → Z)' },
    { value: 'author_asc', label: 'Author (A → Z)' },
  ];

  it('renders all options with currently selected value', () => {
    render(
      <CollectionSortDropdown
        value="recent"
        onChange={vi.fn()}
        options={options}
        ariaLabel="Sort bookmarks"
      />
    );

    const select = screen.getByRole('combobox', { name: 'Sort bookmarks' });
    expect(select).toBeInTheDocument();
    expect(select).toHaveAttribute('title', 'Sort bookmarks');
    expect(select).toHaveValue('recent');
    expect(screen.getByRole('option', { name: 'Recently Read' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Title (A → Z)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Author (A → Z)' })).toBeInTheDocument();
  });

  it('calls onChange with new value when an option is chosen', () => {
    const onChange = vi.fn();
    render(
      <CollectionSortDropdown
        value="recent"
        onChange={onChange}
        options={options}
        ariaLabel="Sort bookmarks"
      />
    );

    const select = screen.getByRole('combobox', { name: 'Sort bookmarks' });
    fireEvent.change(select, { target: { value: 'title_asc' } });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('title_asc');
  });

  it('uses default ariaLabel when not explicitly provided', () => {
    render(<CollectionSortDropdown value="recent" onChange={vi.fn()} options={options} />);
    expect(screen.getByRole('combobox', { name: 'Sort items' })).toBeInTheDocument();
  });

  it('applies responsive mobile flex classes to prevent toolbar overflow', () => {
    render(<CollectionSortDropdown value="recent" onChange={vi.fn()} options={options} />);
    const dropdown = screen.getByTestId('collection-sort-dropdown');
    expect(dropdown).toHaveClass(
      'flex-1',
      'min-w-[130px]',
      'max-w-[215px]',
      'sm:flex-none',
      'sm:min-w-[170px]',
      'sm:max-w-[260px]'
    );
  });

  it('renders sort direction button and handles toggle clicks when onDirectionToggle is provided', () => {
    const onDirectionToggle = vi.fn();
    const { rerender } = render(
      <CollectionSortDropdown
        value="title"
        onChange={vi.fn()}
        options={options}
        sortDirection="asc"
        onDirectionToggle={onDirectionToggle}
      />
    );

    const dirBtn = screen.getByTestId('collection-sort-direction-btn');
    expect(dirBtn).toBeInTheDocument();
    expect(dirBtn).not.toBeDisabled();
    expect(dirBtn).toHaveAttribute('aria-label', 'Sort Ascending (click to sort Descending)');

    fireEvent.click(dirBtn);
    expect(onDirectionToggle).toHaveBeenCalledTimes(1);

    // Rerender as descending
    rerender(
      <CollectionSortDropdown
        value="title"
        onChange={vi.fn()}
        options={options}
        sortDirection="desc"
        onDirectionToggle={onDirectionToggle}
      />
    );
    expect(dirBtn).toHaveAttribute('aria-label', 'Sort Descending (click to sort Ascending)');
  });

  it('disables direction button and sets aria-label when isDirectionDisabled is true', () => {
    const onDirectionToggle = vi.fn();
    render(
      <CollectionSortDropdown
        value="recent"
        onChange={vi.fn()}
        options={options}
        sortDirection="desc"
        onDirectionToggle={onDirectionToggle}
        isDirectionDisabled={true}
        directionAriaLabel="Sorting direction is fixed for Recently Read"
      />
    );

    const dirBtn = screen.getByTestId('collection-sort-direction-btn');
    expect(dirBtn).toBeDisabled();
    expect(dirBtn).toHaveAttribute('aria-label', 'Sorting direction is fixed for Recently Read');
    expect(dirBtn).toHaveClass('opacity-40', 'cursor-not-allowed');

    fireEvent.click(dirBtn);
    expect(onDirectionToggle).not.toHaveBeenCalled();
  });

  it('supports custom test-ids and leading icon override', () => {
    render(
      <CollectionSortDropdown
        value="all"
        onChange={vi.fn()}
        options={[{ value: 'all', label: 'All Items' }]}
        dataTestId="custom-filter-dropdown"
        selectTestId="custom-filter-select"
        icon={<span data-testid="custom-filter-icon">icon</span>}
      />
    );

    expect(screen.getByTestId('custom-filter-dropdown')).toBeInTheDocument();
    expect(screen.getByTestId('custom-filter-select')).toBeInTheDocument();
    expect(screen.getByTestId('custom-filter-icon')).toBeInTheDocument();
  });
});

