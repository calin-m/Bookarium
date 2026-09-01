import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ProfileLibraryStats } from './ProfileLibraryStats';

describe('ProfileLibraryStats Component', () => {
  it('renders library statistics with counts and accessible links', () => {
    render(
      <ProfileLibraryStats
        savedCount={14}
        likedCount={8}
        customShelvesCount={3}
      />
    );

    expect(screen.getByText('14')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();

    expect(screen.getByLabelText('View Shelved Volumes in Bookshelf')).toHaveAttribute('href', '/?view=bookshelf');
    expect(screen.getByLabelText('View Favorite Titles in Favorites')).toHaveAttribute('href', '/?view=likes');
    expect(screen.getByLabelText('View Custom Shelves in Bookshelf')).toHaveAttribute('href', '/?view=bookshelf');
  });
});

