import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { EmailSentView } from './EmailSentView';
import type { TurnstileRenderOptions } from './TurnstileWidget';

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

  it('mounts Turnstile on resend screens when NEXT_PUBLIC_TURNSTILE_SITE_KEY is set and gates/forwards verification token', async () => {
    const prevKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = '0x4AAAAAAATestKey';

    let capturedOptions: TurnstileRenderOptions = { sitekey: '' };
    const resetMock = vi.fn();
    window.turnstile = {
      render: vi.fn((_el: HTMLElement, opts: TurnstileRenderOptions) => {
        capturedOptions = opts;
        return 'sent-view-widget';
      }),
      reset: resetMock,
      remove: vi.fn(),
    };

    const onResend = vi.fn().mockResolvedValue(undefined);

    try {
      render(
        <EmailSentView
          email="test@example.com"
          messagePrefix="We sent a link to"
          onBackToSignIn={vi.fn()}
          onResend={onResend}
        />
      );

      expect(screen.getByTestId('email-sent-turnstile-widget')).toBeInTheDocument();

      // Clicking before Turnstile solves blocks resend with inline hint
      fireEvent.click(screen.getByRole('button', { name: 'Resend Email' }));
      expect(
        screen.getByText(/Please complete the security verification check above before resending/i)
      ).toBeInTheDocument();
      expect(onResend).not.toHaveBeenCalled();

      // Error callback surfaces load error cleanly
      await waitFor(() => {
        capturedOptions['error-callback']?.();
      });
      expect(
        screen.getByText(/Security verification failed to load or verify/i)
      ).toBeInTheDocument();

      // Solving Turnstile clears hint/error and forwards token on click
      await waitFor(() => {
        capturedOptions.callback?.('sent-view-token-789');
      });
      fireEvent.click(screen.getByRole('button', { name: 'Resend Email' }));

      await waitFor(() => {
        expect(onResend).toHaveBeenCalledWith('sent-view-token-789');
      });
      expect(resetMock).toHaveBeenCalledWith('sent-view-widget');
    } finally {
      if (prevKey === undefined) {
        delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
      } else {
        process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = prevKey;
      }
      delete window.turnstile;
    }
  });
});

