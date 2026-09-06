import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { EmailSentView } from './EmailSentView';

describe('EmailSentView Component', () => {
  it('renders title, email, and message prefix', () => {
    const onBack = vi.fn();
    render(
      <EmailSentView
        email="reader@example.com"
        messagePrefix="We sent a verification link to"
        onBackToSignIn={onBack}
      />
    );

    expect(screen.getByText('Check your email')).toBeInTheDocument();
    expect(screen.getByText(/We sent a verification link to/i)).toBeInTheDocument();
    expect(screen.getByText('reader@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to Sign In' })).toBeInTheDocument();
  });

  it('renders optional subtitle and resendSuccess message', () => {
    const onBack = vi.fn();
    render(
      <EmailSentView
        email="test@example.com"
        messagePrefix="We sent a link to"
        subtitle="Verification links expire in 1 hour."
        resendSuccess={true}
        onBackToSignIn={onBack}
      />
    );

    expect(screen.getByText('Verification links expire in 1 hour.')).toBeInTheDocument();
    expect(screen.getByText(/Fresh verification link sent!/i)).toBeInTheDocument();
  });

  it('triggers onBackToSignIn with custom label', () => {
    const onBack = vi.fn();
    render(
      <EmailSentView
        email="test@example.com"
        messagePrefix="We sent a link to"
        onBackToSignIn={onBack}
        backButtonLabel="Go to Sign In"
      />
    );

    const backButton = screen.getByRole('button', { name: 'Go to Sign In' });
    fireEvent.click(backButton);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('renders and handles resend button interactions', () => {
    const onBack = vi.fn();
    const onResend = vi.fn();

    const { rerender } = render(
      <EmailSentView
        email="test@example.com"
        messagePrefix="We sent a link to"
        onBackToSignIn={onBack}
        onResend={onResend}
      />
    );

    const resendBtn = screen.getByRole('button', { name: 'Resend Email' });
    expect(resendBtn).toBeEnabled();
    fireEvent.click(resendBtn);
    expect(onResend).toHaveBeenCalledTimes(1);

    // Re-render when isResending is true
    rerender(
      <EmailSentView
        email="test@example.com"
        messagePrefix="We sent a link to"
        onBackToSignIn={onBack}
        onResend={onResend}
        isResending={true}
      />
    );
    expect(screen.getByRole('button', { name: 'Sending...' })).toBeDisabled();

    // Re-render with cooldown
    rerender(
      <EmailSentView
        email="test@example.com"
        messagePrefix="We sent a link to"
        onBackToSignIn={onBack}
        onResend={onResend}
        resendCooldown={45}
      />
    );
    expect(screen.getByRole('button', { name: 'Resend in 45s' })).toBeDisabled();
  });
});

