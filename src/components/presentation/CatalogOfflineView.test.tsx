import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CatalogOfflineView } from './CatalogOfflineView';

describe('CatalogOfflineView', () => {
  it('renders offline notice and collection counts accurately', () => {
    const onNavigateView = vi.fn();

    render(
      <CatalogOfflineView
        onNavigateView={onNavigateView}
        savedCount={4}
        favoriteCount={1}
        bookmarksCount={2}
        annotationsCount={7}
      />
    );

    expect(screen.getByTestId('catalog-offline-view')).toBeInTheDocument();
    expect(screen.getByText('Offline Mode Active')).toBeInTheDocument();
    expect(screen.getByText('The Live Catalog Is Paused Offline')).toBeInTheDocument();
    expect(screen.getByText('4 volumes')).toBeInTheDocument();
    expect(screen.getByText('1 favorite')).toBeInTheDocument();
    expect(screen.getByText('2 bookmarks')).toBeInTheDocument();
    expect(screen.getByText('7 notes')).toBeInTheDocument();
  });

  it('invokes onNavigateView when clicking personal collection cards', () => {
    const onNavigateView = vi.fn();

    render(
      <CatalogOfflineView
        onNavigateView={onNavigateView}
        savedCount={1}
        favoriteCount={2}
        bookmarksCount={1}
        annotationsCount={1}
      />
    );

    fireEvent.click(screen.getByTestId('offline-nav-bookshelf'));
    expect(onNavigateView).toHaveBeenCalledWith('bookshelf');

    fireEvent.click(screen.getByTestId('offline-nav-favorites'));
    expect(onNavigateView).toHaveBeenCalledWith('favorites');

    fireEvent.click(screen.getByTestId('offline-nav-bookmarks'));
    expect(onNavigateView).toHaveBeenCalledWith('bookmarks');

    fireEvent.click(screen.getByTestId('offline-nav-notebook'));
    expect(onNavigateView).toHaveBeenCalledWith('notebook');

    const accountLink = screen.getByTestId('offline-nav-account');
    expect(accountLink).toHaveAttribute('href', '/account');
  });
});
