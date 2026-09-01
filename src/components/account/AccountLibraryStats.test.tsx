import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AccountLibraryStats } from './AccountLibraryStats';

describe('AccountLibraryStats', () => {
  it('renders library statistics with links and values', () => {
    render(
      <AccountLibraryStats
        savedCount={5}
        likedCount={12}
        customShelvesCount={3}
      />
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Library' })).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByTestId('custom-shelves-count')).toHaveTextContent('3');

    const links = screen.getAllByRole('link');
    expect(links.length).toBe(4); // Open Bookshelf, Shelved, Favorites, Custom Shelves
  });
});

