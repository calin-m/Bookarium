import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import {
  CollectionSearchBar,
  getServerMobileSnapshot,
  getMobileSnapshot,
  subscribeMobile,
} from './CollectionSearchBar';

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

  it('should apply compact right padding (pr-4) when idle and expanded padding (pr-24) when filtering', () => {
    const { rerender } = render(
      <CollectionSearchBar
        query=""
        onQueryChange={vi.fn()}
        totalCount={5}
        filteredCount={5}
        collectionName="bookshelf"
      />
    );

    const input = screen.getByRole('textbox');
    expect(input.className).toContain('pr-4');
    expect(input.className).not.toContain('pr-24');

    rerender(
      <CollectionSearchBar
        query="active search"
        onQueryChange={vi.fn()}
        totalCount={5}
        filteredCount={2}
        collectionName="bookshelf"
      />
    );

    expect(input.className).toContain('pr-24');
  });

  it('should render mobilePlaceholder when screen is mobile viewport and respond to change events', () => {
    let changeHandler: ((e?: any) => void) | undefined;
    const originalMatchMedia = window.matchMedia;

    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('max-width: 639px'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn((event: string, handler: any) => {
        if (event === 'change') changeHandler = handler;
      }),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const { unmount } = render(
      <CollectionSearchBar
        query=""
        onQueryChange={vi.fn()}
        placeholder="Desktop long placeholder..."
        mobilePlaceholder="Mobile short..."
        totalCount={10}
        filteredCount={10}
      />
    );

    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('placeholder', 'Mobile short...');

    // trigger media query listener update
    changeHandler?.({ matches: false });

    unmount();
    window.matchMedia = originalMatchMedia;
  });

  it('should return server and client snapshot correctly and handle undefined matchMedia', () => {
    expect(getServerMobileSnapshot()).toBe(false);
    expect(getMobileSnapshot()).toBe(false);

    const originalMatchMedia = window.matchMedia;
    (window as any).matchMedia = undefined;

    expect(getMobileSnapshot()).toBe(false);
    const unsubscribe = subscribeMobile(vi.fn());
    expect(typeof unsubscribe).toBe('function');
    unsubscribe();

    window.matchMedia = originalMatchMedia;
  });

  it('should render correct accessible labels when collectionName is bookmarks', () => {
    render(
      <CollectionSearchBar
        query="gatsby"
        onQueryChange={vi.fn()}
        totalCount={8}
        filteredCount={1}
        collectionName="bookmarks"
      />
    );

    expect(screen.getByRole('textbox', { name: /search bookmarks/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /clear bookmarks search/i })).toBeInTheDocument();
  });
});
