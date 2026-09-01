import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { CollectionSearchBar } from './CollectionSearchBar';

describe('CollectionSearchBar', () => {
  it('should render search input with placeholder and accessible label', () => {
    render(
      <CollectionSearchBar
        query=""
        onQueryChange={vi.fn()}
        placeholder="Search your bookshelf..."
        totalCount={10}
        filteredCount={10}
        collectionName="bookshelf"
      />
    );

    const input = screen.getByRole('textbox', { name: /search bookshelf/i });
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('placeholder', 'Search your bookshelf...');
  });

  it('should call onQueryChange when user types in the input', () => {
    const handleQueryChange = vi.fn();
    render(
      <CollectionSearchBar
        query=""
        onQueryChange={handleQueryChange}
        totalCount={10}
        filteredCount={10}
      />
    );

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'austen pride' } });

    expect(handleQueryChange).toHaveBeenCalledWith('austen pride');
  });

  it('should display clear button and counter badge when query is present', () => {
    render(
      <CollectionSearchBar
        query="austen"
        onQueryChange={vi.fn()}
        totalCount={12}
        filteredCount={3}
        collectionName="bookshelf"
      />
    );

    expect(screen.getByRole('button', { name: /clear bookshelf search/i })).toBeInTheDocument();
    expect(screen.getByText('3 / 12')).toBeInTheDocument();
  });

  it('should call onQueryChange with empty string when clicking clear button', () => {
    const handleQueryChange = vi.fn();
    render(
      <CollectionSearchBar
        query="frankenstein"
        onQueryChange={handleQueryChange}
        totalCount={5}
        filteredCount={1}
        collectionName="bookshelf"
      />
    );

    const clearBtn = screen.getByRole('button', { name: /clear bookshelf search/i });
    fireEvent.click(clearBtn);

    expect(handleQueryChange).toHaveBeenCalledWith('');
  });

  it('should clear search query when pressing Escape key', () => {
    const handleQueryChange = vi.fn();
    render(
      <CollectionSearchBar
        query="tolstoy"
        onQueryChange={handleQueryChange}
        totalCount={8}
        filteredCount={2}
      />
    );

    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(handleQueryChange).toHaveBeenCalledWith('');
  });

  it('should not display clear button or counter when query is blank or whitespace', () => {
    render(
      <CollectionSearchBar
        query="   "
        onQueryChange={vi.fn()}
        totalCount={5}
        filteredCount={5}
        collectionName="bookshelf"
      />
    );

    expect(screen.queryByRole('button', { name: /clear bookshelf search/i })).not.toBeInTheDocument();
    expect(screen.queryByText('5 / 5')).not.toBeInTheDocument();
  });
});
