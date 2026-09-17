import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CollectionTopPagination } from './CollectionTopPagination';

describe('CollectionTopPagination', () => {
  it('renders null when totalPages is 1 or less', () => {
    const { container: c1 } = render(
      <CollectionTopPagination currentPage={1} totalPages={1} onPageChange={vi.fn()} />
    );
    expect(c1.firstChild).toBeNull();

    const { container: c0 } = render(
      <CollectionTopPagination currentPage={1} totalPages={0} onPageChange={vi.fn()} />
    );
    expect(c0.firstChild).toBeNull();
  });

  it('renders pagination controls and indicator when totalPages > 1', () => {
    render(<CollectionTopPagination currentPage={2} totalPages={4} onPageChange={vi.fn()} />);

    expect(screen.getByTestId('collection-top-pagination')).toBeInTheDocument();
    expect(screen.getByTestId('top-pagination-indicator')).toHaveTextContent('2/4');
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeInTheDocument();
  });

  it('disables previous button on first page and enables next button', () => {
    const onPageChange = vi.fn();
    render(<CollectionTopPagination currentPage={1} totalPages={3} onPageChange={onPageChange} />);

    const prevBtn = screen.getByRole('button', { name: 'Previous page' });
    const nextBtn = screen.getByRole('button', { name: 'Next page' });

    expect(prevBtn).toBeDisabled();
    expect(nextBtn).not.toBeDisabled();

    fireEvent.click(prevBtn);
    expect(onPageChange).not.toHaveBeenCalled();

    fireEvent.click(nextBtn);
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('disables next button on last page and enables previous button', () => {
    const onPageChange = vi.fn();
    render(<CollectionTopPagination currentPage={3} totalPages={3} onPageChange={onPageChange} />);

    const prevBtn = screen.getByRole('button', { name: 'Previous page' });
    const nextBtn = screen.getByRole('button', { name: 'Next page' });

    expect(nextBtn).toBeDisabled();
    expect(prevBtn).not.toBeDisabled();

    fireEvent.click(nextBtn);
    expect(onPageChange).not.toHaveBeenCalled();

    fireEvent.click(prevBtn);
    expect(onPageChange).toHaveBeenCalledWith(2);
  });
});

