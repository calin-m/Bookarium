import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AccountLibraryStats } from './AccountLibraryStats';

describe('AccountLibraryStats', () => {
  it('renders library statistics with links and values including notes and quotes', () => {
    render(
      <AccountLibraryStats
        savedCount={5}
        likedCount={12}
        customShelvesCount={3}
        annotationCount={8}
      />
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Library' })).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByTestId('notes-quotes-count')).toHaveTextContent('8');
    expect(screen.getByTestId('custom-shelves-count')).toHaveTextContent('3');

    const links = screen.getAllByRole('link');
    expect(links.length).toBe(5); // Open Bookshelf, Shelved, Favorites, Notes & Quotes, Custom Shelves
    expect(screen.getByLabelText('View Saved Notes & Quotes in Notebook')).toHaveAttribute(
      'href',
      '/?view=notebook'
    );
  });

  it('renders default 0 for annotationCount when omitted', () => {
    render(
      <AccountLibraryStats
        savedCount={0}
        likedCount={0}
        customShelvesCount={0}
      />
    );

    expect(screen.getByTestId('notes-quotes-count')).toHaveTextContent('0');
  });

  it('applies theme-tokenized hover border and focus classes on each library card', () => {
    render(
      <AccountLibraryStats
        savedCount={2}
        likedCount={4}
        customShelvesCount={1}
        annotationCount={3}
      />
    );

    const shelvedLink = screen.getByLabelText('View Shelved Volumes in Bookshelf');
    const favoritesLink = screen.getByLabelText('View Favorite Titles in Favorites');
    const notesLink = screen.getByLabelText('View Saved Notes & Quotes in Notebook');
    const shelvesLink = screen.getByLabelText('View Custom Shelves in Bookshelf');

    expect(shelvedLink).toHaveClass('hover:border-primary');
    expect(favoritesLink).toHaveClass('hover:border-destructive');
    expect(notesLink).toHaveClass('hover:border-amber-500');
    expect(shelvesLink).toHaveClass('hover:border-primary');
  });
});

