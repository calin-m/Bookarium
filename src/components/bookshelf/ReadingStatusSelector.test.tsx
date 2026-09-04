import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ReadingStatusSelector } from './ReadingStatusSelector';

describe('ReadingStatusSelector', () => {
  it('renders all three reading status options', () => {
    render(<ReadingStatusSelector status={null} onChange={vi.fn()} />);

    expect(screen.getByRole('radio', { name: /want to read/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /currently reading/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /finished/i })).toBeInTheDocument();
  });

  it('marks current status as checked', () => {
    render(<ReadingStatusSelector status="currently_reading" onChange={vi.fn()} />);

    expect(screen.getByRole('radio', { name: /currently reading/i })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: /want to read/i })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('radio', { name: /finished/i })).toHaveAttribute('aria-checked', 'false');
  });

  it('calls onChange with selected status when clicked', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<ReadingStatusSelector status={null} onChange={handleChange} />);

    await user.click(screen.getByRole('radio', { name: /want to read/i }));
    expect(handleChange).toHaveBeenCalledWith('want_to_read');
  });

  it('clears status when clicking the active option', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<ReadingStatusSelector status="finished" onChange={handleChange} />);

    await user.click(screen.getByRole('radio', { name: /finished/i }));
    expect(handleChange).toHaveBeenCalledWith(null);
  });

  it('renders clear button when status is active and invokes onChange(null)', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<ReadingStatusSelector status="currently_reading" onChange={handleChange} showClear />);

    const clearBtn = screen.getByRole('button', { name: /clear reading status/i });
    expect(clearBtn).toBeInTheDocument();

    await user.click(clearBtn);
    expect(handleChange).toHaveBeenCalledWith(null);
  });

  it('renders clear button immediately following the selected option across all status variants', () => {
    const { rerender } = render(<ReadingStatusSelector status="want_to_read" onChange={vi.fn()} showClear />);
    expect(screen.getByRole('button', { name: /clear reading status/i })).toBeInTheDocument();

    rerender(<ReadingStatusSelector status="currently_reading" onChange={vi.fn()} showClear />);
    expect(screen.getByRole('button', { name: /clear reading status/i })).toBeInTheDocument();

    rerender(<ReadingStatusSelector status="finished" onChange={vi.fn()} showClear />);
    expect(screen.getByRole('button', { name: /clear reading status/i })).toBeInTheDocument();

    rerender(<ReadingStatusSelector status={null} onChange={vi.fn()} showClear />);
    expect(screen.queryByRole('button', { name: /clear reading status/i })).not.toBeInTheDocument();
  });
});

