import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PrivateProfileNotice } from './PrivateProfileNotice';
import { ROUTES } from '@/config/routes';

describe('PrivateProfileNotice', () => {
  it('renders neutral not-found sanctuary title and classical description without echoing username', () => {
    render(<PrivateProfileNotice username="secret_scholar" />);

    expect(
      screen.getByRole('region', { name: /scholar sanctuary not found/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: /scholar sanctuary not found/i })).toBeInTheDocument();
    expect(screen.queryByText('@secret_scholar')).not.toBeInTheDocument();
    expect(
      screen.getByText(/this scholar sanctuary does not exist or has not been made public by its owner/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Ralph Waldo Emerson/i)).toBeInTheDocument();
  });

  it('renders catalog navigation buttons with proper hrefs', () => {
    render(<PrivateProfileNotice />);

    const links = screen.getAllByRole('link');
    expect(links.length).toBeGreaterThanOrEqual(2);
    links.forEach((link) => {
      expect(link).toHaveAttribute('href', ROUTES.HOME);
    });

    expect(screen.getByText(/explore public domain library/i)).toBeInTheDocument();
    expect(screen.getByText(/return to catalog/i)).toBeInTheDocument();
  });

  it('renders gracefully without username parameter', () => {
    render(<PrivateProfileNotice />);

    expect(screen.getByRole('heading', { level: 1, name: /scholar sanctuary not found/i })).toBeInTheDocument();
    expect(screen.queryByText(/^@/)).not.toBeInTheDocument();
  });
});

