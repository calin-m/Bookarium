import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ReaderLoadingView } from './ReaderLoadingView';
import { getReaderTheme } from '@/config/reader-themes';

describe('ReaderLoadingView Component', () => {
  it('renders loading indicators and typography text', () => {
    const activeTheme = getReaderTheme('light');
    render(<ReaderLoadingView activeTheme={activeTheme} />);

    expect(screen.getByTestId('reader-loading-view')).toBeInTheDocument();
    expect(
      screen.getByText(/Fetching Masterwork from Project Gutenberg Mirror/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Parsing typography AST, chapters, and volume pagination/i)
    ).toBeInTheDocument();
  });
});

