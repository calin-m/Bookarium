import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import GlobalError from './global-error';

describe('GlobalError Component', () => {
  it('renders critical error message and reset button', () => {
    const resetMock = vi.fn();
    const testError = new Error('Root layout catastrophic failure');

    render(<GlobalError error={testError} reset={resetMock} />);

    expect(screen.getByRole('heading', { name: /critical library error/i })).toBeInTheDocument();
    expect(screen.getByText(/critical system fault at the root level/i)).toBeInTheDocument();

    const reloadButton = screen.getByRole('button', { name: /reload sanctuary/i });
    expect(reloadButton).toBeInTheDocument();

    fireEvent.click(reloadButton);
    expect(resetMock).toHaveBeenCalledTimes(1);
  });

  it('displays error digest when available', () => {
    const resetMock = vi.fn();
    const testError = Object.assign(new Error('Root error'), { digest: 'global-digest-99' });

    render(<GlobalError error={testError} reset={resetMock} />);

    expect(screen.getByText(/digest: global-digest-99/i)).toBeInTheDocument();
  });
});

