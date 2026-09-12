import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CopyrightNoticeBanner } from './CopyrightNoticeBanner';

describe('CopyrightNoticeBanner', () => {
  it('renders standard download withholding banner', () => {
    render(
      <CopyrightNoticeBanner
        country="GB"
        ruleDescription="Life + 70 Years"
        publicDomainYear={2047}
        subtext="In strict accordance with international copyright treaties, direct download files are unavailable in your region."
      />
    );

    expect(screen.getByText('Downloads Withheld Under Local Copyright Law')).toBeInTheDocument();
    expect(screen.getByText(/protected by copyright in GB under Life \+ 70 Years/i)).toBeInTheDocument();
    expect(screen.getByText(/scheduled to enter the public domain in your jurisdiction on January 1, 2047/i)).toBeInTheDocument();
    expect(screen.getByText(/direct download files are unavailable/i)).toBeInTheDocument();
  });

  it('renders compact mobile notice banner with custom testId', () => {
    render(
      <CopyrightNoticeBanner
        country="RO"
        reason="Deceased in 1976. Protected under Life + 70 until January 1, 2047."
        publicDomainYear={2047}
        compact
        testId="mobile-restricted-notice"
      />
    );

    const banner = screen.getByTestId('mobile-restricted-notice');
    expect(banner).toBeInTheDocument();
    expect(screen.getByText('Restricted in RO')).toBeInTheDocument();
    expect(screen.getByText(/Deceased in 1976/i)).toBeInTheDocument();
    expect(screen.getByText(/Scheduled to enter the public domain on January 1, 2047/i)).toBeInTheDocument();
  });
});

