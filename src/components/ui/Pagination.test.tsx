import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Pagination } from './Pagination';

describe('Pagination', () => {
  it('renders null when totalPages is 1 or less', () => {
    const { container: c1 } = render(
      <Pagination currentPage={1} totalPages={1} onPageChange={vi.fn()} />
    );
    expect(c1.firstChild).toBeNull();

    const { container: c0 } = render(
      <Pagination currentPage={1} totalPages={0} onPageChange={vi.fn()} />
    );
    expect(c0.firstChild).toBeNull();
  });

  it('renders pagination controls when totalPages is greater than 1', () => {
    render(<Pagination currentPage={1} totalPages={3} onPageChange={vi.fn()} />);

    expect(screen.getByTestId('pagination-nav')).toBeInTheDocument();
    expect(screen.getByLabelText('Go to previous page')).toBeInTheDocument();
    expect(screen.getByLabelText('Go to next page')).toBeInTheDocument();
    expect(
      screen.getByText((_, el) => el?.tagName.toLowerCase() === 'span' && el?.textContent?.trim() === 'Page 1 of 3')
    ).toBeInTheDocument();
  });

  it('disables previous button on the first page', () => {
    const onPageChange = vi.fn();
    render(<Pagination currentPage={1} totalPages={4} onPageChange={onPageChange} />);

    const prevBtn = screen.getByLabelText('Go to previous page');
    expect(prevBtn).toBeDisabled();

    const nextBtn = screen.getByLabelText('Go to next page');
    expect(nextBtn).not.toBeDisabled();

    fireEvent.click(prevBtn);
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it('disables next button on the last page', () => {
    const onPageChange = vi.fn();
    render(<Pagination currentPage={4} totalPages={4} onPageChange={onPageChange} />);

    const nextBtn = screen.getByLabelText('Go to next page');
    expect(nextBtn).toBeDisabled();

    const prevBtn = screen.getByLabelText('Go to previous page');
    expect(prevBtn).not.toBeDisabled();

    fireEvent.click(nextBtn);
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it('navigates to previous and next pages via buttons', () => {
    const onPageChange = vi.fn();
    render(<Pagination currentPage={2} totalPages={5} onPageChange={onPageChange} />);

    const prevBtn = screen.getByLabelText('Go to previous page');
    fireEvent.click(prevBtn);
    expect(onPageChange).toHaveBeenCalledWith(1);

    const nextBtn = screen.getByLabelText('Go to next page');
    fireEvent.click(nextBtn);
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('navigates directly to a page when a page pill button is clicked', () => {
    const onPageChange = vi.fn();
    render(<Pagination currentPage={1} totalPages={5} onPageChange={onPageChange} />);

    const page3Btn = screen.getByRole('button', { name: 'Go to page 3' });
    fireEvent.click(page3Btn);
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('marks current page with aria-current="page"', () => {
    render(<Pagination currentPage={2} totalPages={5} onPageChange={vi.fn()} />);

    const page2Btn = screen.getByRole('button', { name: 'Go to page 2' });
    expect(page2Btn).toHaveAttribute('aria-current', 'page');

    const page1Btn = screen.getByRole('button', { name: 'Go to page 1' });
    expect(page1Btn).not.toHaveAttribute('aria-current');
  });

  it('renders item range counts when totalItems and pageSize are provided', () => {
    render(
      <Pagination
        currentPage={2}
        totalPages={3}
        pageSize={12}
        totalItems={28}
        onPageChange={vi.fn()}
      />
    );

    // Showing 13–24 of 28 items
    expect(screen.getByText(/Showing/)).toBeInTheDocument();
    expect(screen.getByText('13')).toBeInTheDocument();
    expect(screen.getByText('24')).toBeInTheDocument();
    expect(screen.getByText('28')).toBeInTheDocument();
  });

  it('renders ellipses for large totalPages counts', () => {
    render(<Pagination currentPage={5} totalPages={10} onPageChange={vi.fn()} />);

    const ellipses = screen.getAllByText('…');
    expect(ellipses.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: 'Go to page 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to page 10' })).toBeInTheDocument();
  });
});
