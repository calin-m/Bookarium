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
});

