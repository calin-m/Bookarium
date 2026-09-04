import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import Loading from './loading';

describe('Loading Component', () => {
  it('renders status role with busy indicator', () => {
    render(<Loading />);

    const statusElement = screen.getByRole('status');
    expect(statusElement).toBeInTheDocument();
    expect(statusElement).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText(/loading catalog collection/i)).toBeInTheDocument();
  });
});

