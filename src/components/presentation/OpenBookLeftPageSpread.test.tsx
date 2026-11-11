import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OpenBookLeftPageSpread } from './OpenBookLeftPageSpread';

describe('OpenBookLeftPageSpread', () => {
  it('renders public domain header, book metadata, opening and secondary quotes, and subject footer', () => {
    render(
      <OpenBookLeftPageSpread
        bookId={1342}
        title="Pride and Prejudice"
        authorDisplay="Jane Austen"
        passage={{
          openingLine: 'It is a truth universally acknowledged',
          secondaryQuote: 'Till this moment I never knew myself.',
        }}
        rightHeaderLabel="VOL. #1342"
        primarySubject="Domestic Fiction"
        enableCopyMeta={true}
        copyMetaTestId="test-copy-meta"
        secondaryQuoteTestId="test-secondary-quote"
      />
    );

    expect(screen.getByText('Public Domain')).toBeInTheDocument();
    expect(screen.getByText('VOL. #1342')).toBeInTheDocument();
    expect(screen.getByTestId('test-copy-meta')).toHaveTextContent(
      'Pride and Prejudice'
    );
    expect(
      screen.getByText(/It is a truth universally acknowledged/)
    ).toBeInTheDocument();
    expect(screen.getByTestId('test-secondary-quote')).toHaveTextContent(
      'Till this moment I never knew myself.'
    );
    expect(screen.getByText('Domestic Fiction')).toBeInTheDocument();
  });

  it('renders restricted copyright badge and offline unavailable badge when applicable', () => {
    const { rerender } = render(
      <OpenBookLeftPageSpread
        bookId={1342}
        title="Restricted Volume"
        authorDisplay="Author Name"
        passage={{ openingLine: 'Opening line' }}
        rightHeaderLabel="VOL. #1342"
        primarySubject="Literature"
        isRestricted={true}
        country="DE"
        restrictedBadgeTestId="test-restricted-badge"
      />
    );

    expect(screen.getByTestId('test-restricted-badge')).toHaveTextContent(
      'Protected (DE)'
    );

    rerender(
      <OpenBookLeftPageSpread
        bookId={1342}
        title="Uncached Volume"
        authorDisplay="Author Name"
        passage={{ openingLine: 'Opening line' }}
        rightHeaderLabel="VOL. #1342"
        primarySubject="Literature"
        isUnavailableOffline={true}
        offlineBadgeTestId="test-offline-badge"
      />
    );

    expect(screen.getByTestId('test-offline-badge')).toHaveTextContent(
      'Not Downloaded'
    );
  });
});
