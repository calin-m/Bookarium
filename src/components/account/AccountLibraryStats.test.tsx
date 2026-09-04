import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AccountLibraryStats } from './AccountLibraryStats';

describe('AccountLibraryStats', () => {
  it('renders library statistics with links and values including notes and quotes', () => {
    render(
      <AccountLibraryStats
        savedCount={5}
        favoriteCount={12}
        customShelvesCount={3}
        annotationCount={8}
        bookmarksCount={4}
      />
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Library' })).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByTestId('notes-quotes-count')).toHaveTextContent('8');
    expect(screen.getByTestId('custom-shelves-count')).toHaveTextContent('3');
    expect(screen.getByTestId('bookmarks-count')).toHaveTextContent('4');

    const links = screen.getAllByRole('link');
    expect(links.length).toBe(6); // Open Bookshelf, Shelved, Favorites, Notes & Quotes, Custom Shelves, Bookmarks
    expect(screen.getByLabelText('View Saved Notes & Quotes in Notebook')).toHaveAttribute(
      'href',
      '/?view=notebook'
    );
    expect(screen.getByLabelText('View Reading Bookmarks in Bookmarks')).toHaveAttribute(
      'href',
      '/?view=bookmarks'
    );
  });

  it('renders default 0 for annotationCount and bookmarksCount when omitted', () => {
    render(
      <AccountLibraryStats
        savedCount={0}
        favoriteCount={0}
        customShelvesCount={0}
      />
    );

    expect(screen.getByTestId('notes-quotes-count')).toHaveTextContent('0');
    expect(screen.getByTestId('bookmarks-count')).toHaveTextContent('0');
  });

  it('applies theme-tokenized hover border and focus classes on each library card', () => {
    render(
      <AccountLibraryStats
        savedCount={2}
        favoriteCount={4}
        customShelvesCount={1}
        annotationCount={3}
        bookmarksCount={2}
      />
    );

    const shelvedLink = screen.getByLabelText('View Shelved Volumes in Bookshelf');
    const favoritesLink = screen.getByLabelText('View Favorite Titles in Favorites');
    const notesLink = screen.getByLabelText('View Saved Notes & Quotes in Notebook');
    const shelvesLink = screen.getByLabelText('View Custom Shelves in Bookshelf');
    const bookmarksLink = screen.getByLabelText('View Reading Bookmarks in Bookmarks');

    expect(shelvedLink).toHaveClass('hover:border-primary');
    expect(favoritesLink).toHaveClass('hover:border-destructive');
    expect(notesLink).toHaveClass('hover:border-amber-500');
    expect(shelvesLink).toHaveClass('hover:border-primary');
    expect(bookmarksLink).toHaveClass('hover:border-indigo-500');
  });
});

