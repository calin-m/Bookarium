import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { StarRating } from './StarRating';

describe('StarRating', () => {
  it('renders 5 interactive star buttons in interactive mode', () => {
    render(<StarRating value={null} />);

    const radiogroup = screen.getByRole('radiogroup', { name: /rate 1 to 5 stars/i });
    expect(radiogroup).toBeInTheDocument();

    const stars = screen.getAllByRole('radio');
    expect(stars).toHaveLength(5);
    expect(stars[0]).toHaveAttribute('aria-label', 'Rate 1 of 5 stars');
    expect(stars[4]).toHaveAttribute('aria-label', 'Rate 5 of 5 stars');
  });

  it('marks the active star as aria-checked', () => {
    render(<StarRating value={3} />);

    const stars = screen.getAllByRole('radio');
    expect(stars[2]).toHaveAttribute('aria-checked', 'true');
    expect(stars[0]).toHaveAttribute('aria-checked', 'false');
    expect(stars[3]).toHaveAttribute('aria-checked', 'false');
  });

  it('calls onChange with star index on click', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<StarRating value={null} onChange={handleChange} />);

    const stars = screen.getAllByRole('radio');
    await user.click(stars[3]); // 4th star

    expect(handleChange).toHaveBeenCalledWith(4);
  });

  it('toggles rating off (calls onChange with null) when clicking active star', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<StarRating value={4} onChange={handleChange} />);

    const stars = screen.getAllByRole('radio');
    await user.click(stars[3]); // 4th star is already selected

    expect(handleChange).toHaveBeenCalledWith(null);
  });

  it('updates display rating on hover and restores on mouse leave with fixed width to prevent layout shift', () => {
    render(<StarRating value={2} showLabel />);

    const label = screen.getByText('2/5');
    expect(label).toBeInTheDocument();
    expect(label).toHaveClass('inline-block');
    expect(label).toHaveClass('tabular-nums');
    expect(label).toHaveClass('w-16');

    const stars = screen.getAllByRole('radio');
    fireEvent.mouseEnter(stars[4]); // hover 5th star
    expect(screen.getByText('5/5')).toBeInTheDocument();

    const radiogroup = screen.getByRole('radiogroup');
    fireEvent.mouseLeave(radiogroup);
    expect(screen.getByText('2/5')).toBeInTheDocument();
  });

  it('supports keyboard navigation with arrow keys and enter', () => {
    const handleChange = vi.fn();
    render(<StarRating value={2} onChange={handleChange} />);

    const stars = screen.getAllByRole('radio');
    const selectedStar = stars[1];

    // Arrow Right increments
    fireEvent.keyDown(selectedStar, { key: 'ArrowRight' });
    expect(handleChange).toHaveBeenCalledWith(3);

    // Arrow Left decrements
    fireEvent.keyDown(selectedStar, { key: 'ArrowLeft' });
    expect(handleChange).toHaveBeenCalledWith(1);

    // Enter toggles / selects
    fireEvent.keyDown(selectedStar, { key: 'Enter' });
    expect(handleChange).toHaveBeenCalledWith(null); // was already 2
  });

  it('renders correctly in readOnly mode without interactive buttons', () => {
    const handleChange = vi.fn();
    render(<StarRating value={4} readOnly showLabel onChange={handleChange} />);

    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);

    const container = screen.getByRole('img', { name: /rated 4 of 5 stars/i });
    expect(container).toBeInTheDocument();
    expect(screen.getByText('4/5')).toBeInTheDocument();
  });
});

