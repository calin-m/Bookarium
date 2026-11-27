import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ReaderLoadingView } from './ReaderLoadingView';
import { getReaderTheme } from '@/config/reader-themes';

describe('ReaderLoadingView Component', () => {
  it('renders loading indicators and typography text cleanly when metadata is absent', () => {
    const activeTheme = getReaderTheme('light');
    render(<ReaderLoadingView activeTheme={activeTheme} />);

    expect(screen.getByTestId('reader-loading-view')).toBeInTheDocument();
    expect(screen.queryByTestId('reader-loading-metadata')).not.toBeInTheDocument();
    expect(
      screen.getByText(/Fetching Masterwork from Bookarium Archive/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Parsing typography AST, chapters, and volume pagination/i)
    ).toBeInTheDocument();
  });

  it('renders SSR semantic heading, author, genres, and opening literary hook when authentic metadata is provided', () => {
    const activeTheme = getReaderTheme('sepia');
    render(
      <ReaderLoadingView
        activeTheme={activeTheme}
        bookTitle="Frankenstein"
        bookAuthor="Mary Wollstonecraft Shelley"
        subjects={['Gothic Fiction', 'Science Fiction', 'Horror', 'Extra Tag']}
        openingHook="You will rejoice to hear that no disaster has accompanied the commencement of an enterprise."
      />
    );

    expect(screen.getByTestId('reader-loading-metadata')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Frankenstein' })).toBeInTheDocument();
    expect(screen.getByText(/by Mary Wollstonecraft Shelley/i)).toBeInTheDocument();
    expect(screen.getByText('Gothic Fiction')).toBeInTheDocument();
    expect(screen.queryByText('Extra Tag')).not.toBeInTheDocument();
    expect(screen.getByText(/You will rejoice to hear/i)).toBeInTheDocument();
  });
});
