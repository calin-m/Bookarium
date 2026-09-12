import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ContentAdvisoryBanner } from './ContentAdvisoryBanner';

describe('ContentAdvisoryBanner component', () => {
  it('renders default advisory with standard message', () => {
    render(<ContentAdvisoryBanner />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Historical Content Advisory')).toBeInTheDocument();
    expect(
      screen.getByText(/This historical volume contains unexpurgated mature themes reflective of its era/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Preserved for open cultural heritage and educational study/i)
    ).toBeInTheDocument();
  });

  it('renders customized matched subject', () => {
    render(<ContentAdvisoryBanner matchedSubject="Erotic literature" />);

    expect(
      screen.getByText(/This historical volume contains mature themes \(Erotic literature\) preserved unedited/i)
    ).toBeInTheDocument();
  });

  it('renders custom explicit message and custom title', () => {
    render(
      <ContentAdvisoryBanner
        title="Custom Advisory Title"
        message="Explicit custom advisory content."
        testId="custom-advisory"
      />
    );

    expect(screen.getByTestId('custom-advisory')).toBeInTheDocument();
    expect(screen.getByText('Custom Advisory Title')).toBeInTheDocument();
    expect(screen.getByText('Explicit custom advisory content.')).toBeInTheDocument();
  });

  it('renders in compact mode without footer note', () => {
    render(<ContentAdvisoryBanner compact={true} testId="compact-advisory" />);

    expect(screen.getByTestId('compact-advisory')).toBeInTheDocument();
    expect(
      screen.queryByText(/Preserved for open cultural heritage and educational study/i)
    ).not.toBeInTheDocument();
  });
});

