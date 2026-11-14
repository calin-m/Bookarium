import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { BookGrid } from './BookGrid';
import { mockBooks } from '@/mocks/handlers';

describe('BookGrid component', () => {
  it('should render loading skeletons when isLoading is true and match pageSize', () => {
    const { rerender } = render(<BookGrid isLoading pageSize={16} onPageChange={() => {}} page={2} />);
    expect(screen.getAllByTestId('book-skeleton').length).toBe(16);
    expect(screen.getByLabelText('Previous page')).toBeDisabled();
    expect(screen.getByLabelText('Next page')).toBeDisabled();
    expect(screen.getByText('Page 2')).toBeInTheDocument();

    rerender(<BookGrid isLoading pageSize={8} />);
    expect(screen.getAllByTestId('book-skeleton').length).toBe(8);
  });

  it('should render error state with retry button', () => {
    const handleRetry = vi.fn();
    render(<BookGrid isError onRetry={handleRetry} />);

    expect(screen.getByText(/Failed to fetch books/i)).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: /Retry Query/i });
    fireEvent.click(retryBtn);
    expect(handleRetry).toHaveBeenCalledTimes(1);
  });

  it('should render empty state when no books exist', () => {
    render(<BookGrid books={[]} emptyTitle="Custom Empty Message" />);
    expect(screen.getByText('Custom Empty Message')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Explore Catalog/i })).not.toBeInTheDocument();
  });

  it('should render unified editorial empty state with Explore Catalog CTA for empty favorites view', () => {
    const handleBrowse = vi.fn();
    render(
      <BookGrid
        books={[]}
        activeView="favorites"
        emptyTitle="No Favorites Yet"
        emptyDescription="Click the heart icon on any classic book card to curate your favorite reading collection."
        onBrowseCatalog={handleBrowse}
      />
    );

    const heading = screen.getByRole('heading', { name: 'No Favorites Yet' });
    expect(heading).toBeInTheDocument();
    expect(heading.closest('div')).toHaveClass('bg-card', 'rounded-2xl', 'p-12', 'max-w-lg');

    const exploreBtn = screen.getByRole('button', { name: /Explore Catalog/i });
    expect(exploreBtn.querySelector('svg')).not.toBeNull();
    fireEvent.click(exploreBtn);
    expect(handleBrowse).toHaveBeenCalledTimes(1);
  });

  it('should render Clear Search without Explore Catalog on catalog empty search results', () => {
    const handleClear = vi.fn();
    const handleBrowse = vi.fn();
    render(
      <BookGrid
        books={[]}
        activeView="catalog"
        emptyTitle="No Matching Books"
        emptyDescription="Try clearing your search filter."
        onBrowseCatalog={handleBrowse}
        onClearSearch={handleClear}
      />
    );

    expect(screen.queryByRole('button', { name: /Explore Catalog/i })).not.toBeInTheDocument();
    const clearBtn = screen.getByRole('button', { name: /Clear Search/i });
    fireEvent.click(clearBtn);
    expect(handleClear).toHaveBeenCalledTimes(1);
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

  it('should switch between editorial grid and bookshelf rack views with tactile page-turn transition', () => {
    const { container } = render(<BookGrid books={mockBooks} />);

    // Default is grid
    const content = container.querySelector('#book-grid-content');
    expect(content).toBeInTheDocument();
    expect(content).toHaveClass('animate-page-turn');
    expect(content).toHaveClass('[overflow-anchor:none]');
    expect(content).toHaveClass('relative', 'z-20');
    expect(screen.getByTestId(`book-card-${mockBooks[0].id}`)).toBeInTheDocument();

    // Click bookshelf rack view
    const shelfBtn = screen.getByLabelText('Bookshelf spine view');
    fireEvent.click(shelfBtn);

    expect(screen.getByTestId('bookshelf-rack')).toBeInTheDocument();
    expect(screen.getByTestId(`shelf-book-${mockBooks[0].id}`)).toBeInTheDocument();
    expect(container.querySelector('#book-grid-content')).toHaveClass('animate-page-turn');

    // Click back to grid
    const gridBtn = screen.getByLabelText('Grid cover view');
    fireEvent.click(gridBtn);
    expect(screen.getByTestId(`book-card-${mockBooks[0].id}`)).toBeInTheDocument();
    expect(container.querySelector('#book-grid-content')).toHaveClass('animate-page-turn');
  });

  it('should forward onPreviewClick to BookCard', () => {
    const handlePreview = vi.fn();
    render(<BookGrid books={mockBooks} onPreviewClick={handlePreview} />);

    const coverVisual = screen.getByLabelText(`Click to preview quotes for ${mockBooks[0].title}`);
    fireEvent.click(coverVisual);
    expect(handlePreview).toHaveBeenCalledWith(mockBooks[0], expect.any(Object));
  });

  it('applies responsive active preview classes when activePreviewBookId matches', () => {
    render(<BookGrid books={mockBooks} activePreviewBookId={mockBooks[0].id} />);

    const activeCard = screen.getByTestId(`book-card-${mockBooks[0].id}`);
    expect(activeCard).toHaveClass('lg:opacity-0');
    expect(activeCard).toHaveClass('max-lg:ring-2');
  });

  it('omits personal shelf management buttons in shelf view when in catalog mode', async () => {
    await act(async () => {
      render(<BookGrid books={mockBooks} viewMode="shelf" activeView="catalog" />);
    });

    expect(screen.getByTestId('bookshelf-rack')).toBeInTheDocument();
    expect(screen.getByTestId(`shelf-book-${mockBooks[0].id}`)).toBeInTheDocument();

    // Personal library management controls should not be rendered
    expect(screen.queryByText('General')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /new shelf/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /download shelf offline/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Sign In$/i })).not.toBeInTheDocument();
  });

  it('renders personal shelf management buttons in shelf view when activeView is bookshelf', async () => {
    await act(async () => {
      render(<BookGrid books={mockBooks} viewMode="shelf" activeView="bookshelf" />);
    });

    expect(screen.getByTestId('bookshelf-rack')).toBeInTheDocument();
    expect(screen.getByText('General')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Sign In$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /download all books on this shelf/i })).not.toBeInTheDocument();
  });

  it('applies tightened 2-column mobile grid gap classes to prevent grid blowout', () => {
    const { container } = render(<BookGrid books={mockBooks} />);

    const gridContainer = container.querySelector('#book-grid-content > div');
    expect(gridContainer).toHaveClass('grid-cols-2', 'gap-2.5', 'sm:gap-6');
  });

  it('applies responsive container and pagination bar spacing classes', () => {
    const handlePage = vi.fn();
    render(<BookGrid books={mockBooks} page={1} onPageChange={handlePage} hasNextPage={true} />);

    const mainContainer = screen.getByTestId('book-grid-container');
    expect(mainContainer).toHaveClass('space-y-6', 'sm:space-y-8');

    const paginationBar = screen.getByTestId('catalog-pagination-bar');
    expect(paginationBar).toHaveClass('pt-5', 'sm:pt-6');
  });

  it('keeps pagination controls accessible on empty pages beyond page 1 so users can navigate back', () => {
    const handlePageChange = vi.fn();
    const { rerender } = render(
      <BookGrid
        books={[]}
        activeView="catalog"
        emptyTitle="No Matching Books"
        page={2}
        hasNextPage={false}
        onPageChange={handlePageChange}
      />
    );

    expect(screen.getByText('No Matching Books')).toBeInTheDocument();
    const paginationBar = screen.getByTestId('catalog-pagination-bar');
    expect(paginationBar).toBeInTheDocument();
    expect(screen.getByText('Page 2')).toBeInTheDocument();

    const prevBtn = screen.getByLabelText('Previous page');
    expect(prevBtn).not.toBeDisabled();
    fireEvent.click(prevBtn);
    expect(handlePageChange).toHaveBeenCalledWith(1);

    // On page 1 empty state, pagination bar is omitted
    rerender(
      <BookGrid
        books={[]}
        activeView="catalog"
        emptyTitle="No Matching Books"
        page={1}
        hasNextPage={false}
        onPageChange={handlePageChange}
      />
    );
    expect(screen.queryByTestId('catalog-pagination-bar')).not.toBeInTheDocument();
  });
});

