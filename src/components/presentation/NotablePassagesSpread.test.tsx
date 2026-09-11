import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { NotablePassagesSpread } from './NotablePassagesSpread';

describe('NotablePassagesSpread component', () => {
  it('renders primary quote with CC0 header badge', () => {
    render(
      <NotablePassagesSpread
        passage={{
          quoteExcerpt: 'It is a truth universally acknowledged...',
        }}
      />
    );

    expect(screen.getByText('Notable Passages')).toBeInTheDocument();
    expect(screen.getByText('CC0 / Free')).toBeInTheDocument();
    expect(screen.getByText('It is a truth universally acknowledged...')).toBeInTheDocument();
    expect(screen.queryByTestId('notable-passage-secondary')).not.toBeInTheDocument();
    expect(screen.queryByTestId('notable-passage-tertiary')).not.toBeInTheDocument();
  });

  it('renders secondary and tertiary quotes when provided', () => {
    render(
      <NotablePassagesSpread
        passage={{
          quoteExcerpt: 'Primary quote excerpt',
          rightPageQuote2: 'Secondary quote excerpt',
          tertiaryQuote: 'Tertiary quote excerpt',
        }}
      />
    );

    expect(screen.getByText('Primary quote excerpt')).toBeInTheDocument();
    expect(screen.getByTestId('notable-passage-secondary')).toHaveTextContent('Secondary quote excerpt');
    expect(screen.getByTestId('notable-passage-tertiary')).toHaveTextContent('Tertiary quote excerpt');
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

  it('renders Protected (RO) header badge when isRestricted is true', () => {
    render(
      <NotablePassagesSpread
        passage={{
          quoteExcerpt: 'Protected quote excerpt',
        }}
        isRestricted={true}
        country="RO"
      />
    );

    expect(screen.getByText('Notable Passages')).toBeInTheDocument();
    expect(screen.queryByText('CC0 / Free')).not.toBeInTheDocument();
    expect(screen.getByTestId('notable-passages-restricted-badge')).toHaveTextContent('Protected (RO)');
  });
});

