import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Alert } from './Alert';

describe('Alert component', () => {
  it('renders info, success, warning, error, and neutral role defaults accurately', () => {
    const { rerender } = render(
      <Alert variant="info" icon={<span data-testid="alert-icon">i</span>}>
        Recovery link verified
      </Alert>
    );

    const statusBox = screen.getByRole('status');
    expect(statusBox).toHaveClass('bg-primary/10', 'text-primary');
    expect(statusBox).toHaveTextContent('Recovery link verified');
    expect(screen.getByTestId('alert-icon')).toBeInTheDocument();

    rerender(<Alert variant="warning">Pin limit reached</Alert>);
    expect(screen.getByRole('alert')).toHaveClass('bg-amber-500/10', 'text-amber-800');

    rerender(<Alert variant="error">Invalid credentials</Alert>);
    expect(screen.getByRole('alert')).toHaveClass('bg-destructive/10', 'text-destructive');

    rerender(
      <Alert variant="neutral" role={null} data-testid="static-tip">
        Symposium privacy tip
      </Alert>
    );
    const tip = screen.getByTestId('static-tip');
    expect(tip).not.toHaveAttribute('role');
    expect(tip).toHaveClass('bg-muted/30');
  });

  it('supports stacked vertical layout when footer slot is supplied', () => {
    render(
      <Alert
        variant="error"
        role={null}
        data-testid="auth-error-alert"
        icon={<span>!</span>}
        footer={<button type="button">Resend Link</button>}
      >
        Email not confirmed
      </Alert>
    );

    const box = screen.getByTestId('auth-error-alert');
    expect(box).toHaveClass('space-y-2');
    expect(box).not.toHaveClass('flex');
    expect(box).toHaveTextContent('Email not confirmed');
    expect(screen.getByRole('button', { name: 'Resend Link' })).toBeInTheDocument();
  });
});
