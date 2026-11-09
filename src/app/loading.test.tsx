import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Loading from './loading';

describe('Loading Component (App Router Splash)', () => {
  it('renders an accessible loading screen with Bookarium branding and status announcement', () => {
    render(<Loading />);

    const statusEl = screen.getByRole('status', { name: /Loading Bookarium library/i });
    expect(statusEl).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: /Bookarium/i })).toBeInTheDocument();
    expect(screen.getByText(/Opening universal public domain library/i)).toBeInTheDocument();
    expect(screen.getByText('Loading...')).toHaveClass('sr-only');

    const emblem = screen.getByTestId('loading-brand-emblem');
    expect(emblem).toBeInTheDocument();
    expect(emblem).toHaveAttribute('viewBox', '30 38 456 456');
    expect(emblem).toHaveClass('w-16', 'h-16');
  });
});

