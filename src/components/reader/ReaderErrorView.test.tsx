import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ReaderErrorView } from './ReaderErrorView';
import { getReaderTheme } from '@/config/reader-themes';

describe('ReaderErrorView Component', () => {
  it('renders error message and retry button', () => {
    const activeTheme = getReaderTheme('light');
    const handleRetry = vi.fn();
    render(<ReaderErrorView activeTheme={activeTheme} onRetry={handleRetry} />);

    expect(screen.getByTestId('reader-error-view')).toBeInTheDocument();
    expect(screen.getByText(/Unable to Load Masterwork Text/i)).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: /Retry Connection/i });
    expect(retryBtn).toBeInTheDocument();
    fireEvent.click(retryBtn);
    expect(handleRetry).toHaveBeenCalledTimes(1);
  });

  it('renders without retry button when onRetry is not provided', () => {
    const activeTheme = getReaderTheme('light');
    render(<ReaderErrorView activeTheme={activeTheme} />);

    expect(screen.queryByRole('button', { name: /Retry Connection/i })).not.toBeInTheDocument();
  });
});

