import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PrivateProfileNotice } from './PrivateProfileNotice';
import { ROUTES } from '@/config/routes';

describe('PrivateProfileNotice', () => {
  it('renders private sanctuary title and classical description', () => {
    render(<PrivateProfileNotice username="secret_scholar" />);

    expect(
      screen.getByRole('region', { name: /private scholar sanctuary/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: /private scholar sanctuary/i })).toBeInTheDocument();
    expect(screen.getByText('@secret_scholar')).toBeInTheDocument();
    expect(
      screen.getByText(/this reader has chosen to keep their reading sanctuary private/i)
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

    expect(screen.getByRole('heading', { level: 1, name: /private scholar sanctuary/i })).toBeInTheDocument();
    expect(screen.queryByText(/^@/)).not.toBeInTheDocument();
  });
});

