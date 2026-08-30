import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { BookGrid } from './BookGrid';
import { mockBooks } from '@/mocks/handlers';

describe('BookGrid component', () => {
  it('should render loading skeletons when isLoading is true', () => {
    render(<BookGrid isLoading />);
    expect(screen.getAllByTestId('book-skeleton').length).toBeGreaterThan(0);
  });

  it('should render error state with retry button', () => {
    const handleRetry = vi.fn();
    render(<BookGrid isError onRetry={handleRetry} />);

    expect(screen.getByText(/Failed to load public domain catalog/i)).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: /Retry Connection/i });
    fireEvent.click(retryBtn);
    expect(handleRetry).toHaveBeenCalledTimes(1);
  });

  it('should render empty state when no books exist', () => {
    render(<BookGrid books={[]} emptyTitle="Custom Empty Message" />);
    expect(screen.getByText('Custom Empty Message')).toBeInTheDocument();
  });

  it('should render book cards and trigger pagination', () => {
    const handlePageChange = vi.fn();
    render(
      <BookGrid
        books={mockBooks}
        page={2}
        onPageChange={handlePageChange}
        hasNextPage={true}
      />
    );

    expect(screen.getByText('Pride and Prejudice')).toBeInTheDocument();
    expect(screen.getByText('Page 2')).toBeInTheDocument();

    const prevBtn = screen.getByLabelText('Previous page');
    fireEvent.click(prevBtn);
    expect(handlePageChange).toHaveBeenCalledWith(1);

    const nextBtn = screen.getByLabelText('Next page');
    fireEvent.click(nextBtn);
    expect(handlePageChange).toHaveBeenCalledWith(3);
  });

  it('should switch between editorial grid and bookshelf rack views', () => {
    render(<BookGrid books={mockBooks} />);

    // Default is grid
    expect(screen.getByTestId(`book-card-${mockBooks[0].id}`)).toBeInTheDocument();

    // Click bookshelf rack view
    const shelfBtn = screen.getByLabelText('Bookshelf spine view');
    fireEvent.click(shelfBtn);

    expect(screen.getByTestId('bookshelf-rack')).toBeInTheDocument();
    expect(screen.getByTestId(`shelf-book-${mockBooks[0].id}`)).toBeInTheDocument();

    // Click back to grid
    const gridBtn = screen.getByLabelText('Editorial grid view');
    fireEvent.click(gridBtn);
    expect(screen.getByTestId(`book-card-${mockBooks[0].id}`)).toBeInTheDocument();
  });
});
