import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ReaderErrorView } from './ReaderErrorView';
import { getReaderTheme } from '@/config/reader-themes';
import { LegalRestrictionError } from '@/hooks/queries/useBookContent';

describe('ReaderErrorView Component', () => {
  it('renders error message and retry button for generic errors', () => {
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

  it('renders dedicated HTTP 451 legal restriction view when error is LegalRestrictionError', () => {
    const activeTheme = getReaderTheme('light');
    const legalErr = new LegalRestrictionError({
      country: 'GB',
      rule: 'LIFE_70',
      restrictingAuthor: 'George Orwell',
      restrictingDeathYear: 1950,
      publicDomainYear: 2021,
      reason: 'Protected under UK Life + 70 copyright statute.',
    });

    render(<ReaderErrorView activeTheme={activeTheme} error={legalErr} />);

    expect(screen.getByTestId('reader-legal-restriction-view')).toBeInTheDocument();
    expect(screen.getByText(/HTTP 451: Unavailable For Legal Reasons/i)).toBeInTheDocument();
    expect(screen.getByText(/Protected by Copyright in Your Jurisdiction/i)).toBeInTheDocument();
    expect(screen.getByText(/Protected under UK Life \+ 70 copyright statute\./i)).toBeInTheDocument();
    expect(screen.getByText('George Orwell')).toBeInTheDocument();
    expect(screen.getByText(/Projected Public Domain: 2021/i)).toBeInTheDocument();

    const returnLink = screen.getByRole('link', { name: /Return to Library/i });
    expect(returnLink).toBeInTheDocument();
    expect(returnLink).toHaveAttribute('href', '/');

    const copyrightLink = screen.getByRole('link', { name: /Learn About Copyright Jurisdictions/i });
    expect(copyrightLink).toBeInTheDocument();
    expect(copyrightLink).toHaveAttribute('href', '/copyright');

    // Should NOT render retry connection button
    expect(screen.queryByRole('button', { name: /Retry Connection/i })).not.toBeInTheDocument();
  });

  it('renders legal restriction view for plain object with isLegalRestriction: true', () => {
    const activeTheme = getReaderTheme('sepia');
    const fakeLegalErr = {
      isLegalRestriction: true,
      details: {
        country: 'FR',
        rule: 'LIFE_70',
      },
    };

    render(<ReaderErrorView activeTheme={activeTheme} error={fakeLegalErr} />);

    expect(screen.getByTestId('reader-legal-restriction-view')).toBeInTheDocument();
    expect(screen.getByText(/Protected under local copyright law in FR\./i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Return to Library/i })).toBeInTheDocument();
  });

  it('renders authentic bookTitle and bookAuthor in legal restriction view when provided', () => {
    const activeTheme = getReaderTheme('light');
    const legalErr = new LegalRestrictionError({
      country: 'RO',
      rule: 'LIFE_70',
      reason: 'Protected under Romanian copyright law.',
    });

    render(
      <ReaderErrorView
        activeTheme={activeTheme}
        error={legalErr}
        bookTitle="The Silent Barrier"
        bookAuthor="Louis Tracy"
      />
    );

    expect(screen.getByRole('heading', { level: 1, name: 'The Silent Barrier' })).toBeInTheDocument();
    expect(screen.getByText(/by Louis Tracy/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /Protected by Copyright in Your Jurisdiction/i })).toBeInTheDocument();
  });

  it('renders authentic bookTitle and bookAuthor in generic error view when provided', () => {
    const activeTheme = getReaderTheme('light');

    render(
      <ReaderErrorView
        activeTheme={activeTheme}
        bookTitle="The Silent Barrier"
        bookAuthor="Louis Tracy"
      />
    );

    expect(screen.getByRole('heading', { level: 1, name: 'The Silent Barrier' })).toBeInTheDocument();
    expect(screen.getByText(/by Louis Tracy/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /Unable to Load Masterwork Text/i })).toBeInTheDocument();
  });
});


