import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { NotablePassagesSpread } from './NotablePassagesSpread';

describe('NotablePassagesSpread component', () => {
  it('renders primary quote with CC0 header badge and single outer curly quotes', () => {
    render(
      <NotablePassagesSpread
        passage={{
          quoteExcerpt: '“It is a truth universally acknowledged...”',
        }}
      />
    );

    expect(screen.getByText('Notable Passages')).toBeInTheDocument();
    expect(screen.getByText('CC0 / Free')).toBeInTheDocument();
    const primaryBox = screen.getByTestId('notable-passage-primary');
    expect(primaryBox).toHaveTextContent('“It is a truth universally acknowledged...”');
    expect(primaryBox.textContent).not.toContain('““');
    expect(screen.queryByTestId('notable-passage-secondary')).not.toBeInTheDocument();
    expect(screen.queryByTestId('notable-passage-tertiary')).not.toBeInTheDocument();
  });

  it('renders secondary and tertiary quotes when provided without double quotation marks', () => {
    render(
      <NotablePassagesSpread
        passage={{
          quoteExcerpt: 'Primary quote excerpt',
          rightPageQuote2: '“Secondary quote excerpt”',
          tertiaryQuote: '"Tertiary quote excerpt"',
        }}
      />
    );

    expect(screen.getByTestId('notable-passage-primary')).toHaveTextContent('“Primary quote excerpt”');
    expect(screen.getByTestId('notable-passage-secondary')).toHaveTextContent('“Secondary quote excerpt”');
    expect(screen.getByTestId('notable-passage-secondary').textContent).not.toContain('““');
    expect(screen.getByTestId('notable-passage-tertiary')).toHaveTextContent('“Tertiary quote excerpt”');
  });

  it('adjusts padding and line clamp when there are 2 quotes', () => {
    render(
      <NotablePassagesSpread
        passage={{
          quoteExcerpt: 'Primary quote',
          rightPageQuote2: 'Secondary quote',
        }}
      />
    );

    const primaryBox = screen.getByTestId('notable-passage-primary');
    expect(primaryBox.className).toContain('p-2.5 sm:p-3');
    expect(screen.getByTestId('notable-passage-secondary')).toBeInTheDocument();
    expect(screen.queryByTestId('notable-passage-tertiary')).not.toBeInTheDocument();
  });

  it('renders Protected (RO) header badge and Jurisdictional Protection card when isRestricted is true', () => {
    render(
      <NotablePassagesSpread
        passage={{
          quoteExcerpt: 'Protected quote excerpt',
        }}
        isRestricted={true}
        country="RO"
        evaluation={{
          isAllowed: false,
          country: 'RO',
          rule: 'LIFE_70',
          publicDomainYear: 2047,
          reason: 'Protected in Romania: Author died in 1976 (Life+70 rule applies; public domain in 2047)',
        }}
      />
    );

    expect(screen.getByText('Notable Passages')).toBeInTheDocument();
    expect(screen.queryByText('CC0 / Free')).not.toBeInTheDocument();
    expect(screen.getByTestId('notable-passages-restricted-badge')).toHaveTextContent('Protected (RO)');
    expect(screen.getByTestId('notable-passage-restricted-card')).toBeInTheDocument();
    expect(screen.getByText('Jurisdictional Protection Notice')).toBeInTheDocument();
    expect(
      screen.getByText('Protected in Romania: Author died in 1976 (Life+70 rule applies; public domain in 2047)')
    ).toBeInTheDocument();
    expect(screen.getByText(/In compliance with international copyright treaties/i)).toBeInTheDocument();
    expect(screen.getByText('2047')).toBeInTheDocument();
    expect(screen.queryByTestId('notable-passage-loading')).not.toBeInTheDocument();
    expect(screen.queryByTestId('notable-passage-primary')).not.toBeInTheDocument();
  });

  it('renders fallback reason in Jurisdictional Protection card when evaluation.reason is omitted', () => {
    render(
      <NotablePassagesSpread
        passage={{
          quoteExcerpt: 'Protected quote excerpt',
        }}
        isRestricted={true}
        country="MX"
        isLoading={true}
      />
    );

    expect(screen.getByTestId('notable-passage-restricted-card')).toBeInTheDocument();
    expect(screen.getByText('This volume is protected by copyright in MX.')).toBeInTheDocument();
    expect(screen.queryByTestId('notable-passage-loading')).not.toBeInTheDocument();
  });

  it('renders Not Downloaded header badge when isUnavailableOffline is true and not restricted', () => {
    render(
      <NotablePassagesSpread
        passage={{
          quoteExcerpt: 'Offline quote excerpt',
        }}
        isRestricted={false}
        isUnavailableOffline={true}
      />
    );

    expect(screen.getByText('Notable Passages')).toBeInTheDocument();
    expect(screen.queryByText('CC0 / Free')).not.toBeInTheDocument();
    expect(screen.getByTestId('notable-passages-offline-unavailable-badge')).toHaveTextContent('Not Downloaded');
  });

  it('renders Extracting Passages… badge, active loading card, and scan indicator when isLoading is true', () => {
    render(
      <NotablePassagesSpread
        passage={{
          quoteExcerpt: 'Streaming unabridged text from Project Gutenberg...',
        }}
        isLoading={true}
      />
    );

    expect(screen.getByTestId('notable-passages-extracting-badge')).toHaveTextContent('Extracting Passages…');
    expect(screen.getByTestId('notable-passage-loading')).toBeInTheDocument();
    expect(screen.getByText('Extracting Volume Passages…')).toBeInTheDocument();
    expect(screen.getByText('Streaming unabridged text from Project Gutenberg...')).toBeInTheDocument();
    expect(screen.getByText('Scanning narrative chapters for authentic dialogue')).toBeInTheDocument();
    expect(screen.queryByTestId('notable-passage-primary')).not.toBeInTheDocument();
  });
});

