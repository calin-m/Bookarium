import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import NotFound from './not-found';

describe('NotFound Component (404)', () => {
  it('renders heading, literary quote, and navigation links', () => {
    render(<NotFound />);

    expect(screen.getByRole('heading', { name: /lost in the stacks/i })).toBeInTheDocument();
    expect(screen.getByText(/error 404/i)).toBeInTheDocument();
    expect(screen.getByText(/charles dickens/i)).toBeInTheDocument();

    const catalogLink = screen.getByRole('link', { name: /explore public catalog/i });
    expect(catalogLink).toHaveAttribute('href', '/');

    const bookshelfLink = screen.getByRole('link', { name: /my bookshelf/i });
    expect(bookshelfLink).toHaveAttribute('href', '/?view=bookshelf');
  });
});

