import React from 'react';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AccountIdentityCard } from './AccountIdentityCard';

describe('AccountIdentityCard (Slim Scholar Identity Ribbon)', () => {
  const mockVerifiedUser = {
    id: 'u1',
    email: 'reader@bookarium.test',
    email_confirmed_at: '2026-01-01T12:00:00Z',
    user_metadata: { display_name: 'Test Reader' },
  } as any;

  const mockUnverifiedUser = {
    id: 'u2',
    email: 'unverified@bookarium.test',
    email_confirmed_at: null,
    user_metadata: { display_name: 'New Reader' },
  } as any;

  const mockProfile = {
    id: 'u1',
    display_name: 'Test Reader',
    username: 'test_scholar',
    preferred_theme: 'light',
  } as any;

  it('renders PublicProfileView-styled hero identity header without inline name form or duplicate collection links', () => {
    render(
      <AccountIdentityCard
        user={mockVerifiedUser}
        profile={{ ...mockProfile, is_public: true }}
        formattedDate="January 2026"
        readingStreak={7}
      />
    );

    const ribbon = screen.getByTestId('scholar-identity-ribbon');
    expect(ribbon).toBeInTheDocument();
    expect(ribbon).toHaveClass('rounded-3xl', 'p-6', 'sm:p-8', 'shadow-booksaw');
    expect(screen.getByTestId('identity-monogram-seal')).toHaveTextContent('TR');
    expect(screen.getByText('Test Reader')).toBeInTheDocument();
    expect(screen.queryByText('@test_scholar')).not.toBeInTheDocument();
    expect(screen.queryByText('Public at /u/test_scholar')).not.toBeInTheDocument();
    expect(screen.queryByText('Private Account')).not.toBeInTheDocument();
    expect(screen.queryByText('reader@bookarium.test')).not.toBeInTheDocument();
    expect(screen.getByText('Joined January 2026')).toBeInTheDocument();
    expect(screen.getByText('Verified Reader')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Edit display name/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Display Name')).not.toBeInTheDocument();

    expect(screen.queryByTestId('identity-ribbon-stat-strip')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Shelved/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Favorites/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Bookmarks/i })).not.toBeInTheDocument();

    expect(screen.getByText('🔥 7d Streak')).toBeInTheDocument();
    expect(screen.getByTestId('identity-streak-badge')).toBeInTheDocument();
  });

  it('always renders a neutral 🔥 0d Streak pill when readingStreak is 0 to prevent hydration CLS', () => {
    const onOpenLibraryBreakdown = vi.fn();

    render(
      <AccountIdentityCard
        user={mockVerifiedUser}
        profile={mockProfile}
        formattedDate="January 2026"
        readingStreak={0}
        onOpenLibraryBreakdown={onOpenLibraryBreakdown}
      />
    );

    const zeroStreakPill = screen.getByRole('button', { name: '🔥 0d Streak' });
    expect(zeroStreakPill).toBeInTheDocument();
    expect(zeroStreakPill).toHaveClass('bg-muted/30', 'text-muted-foreground', 'whitespace-nowrap');

    fireEvent.click(zeroStreakPill);
    expect(onOpenLibraryBreakdown).toHaveBeenCalledTimes(1);
  });

  it('renders unverified badge and handles resend verification click', () => {
    const onResendVerification = vi.fn();

    render(
      <AccountIdentityCard
        user={mockUnverifiedUser}
        profile={null}
        formattedDate="February 2026"
        onResendVerification={onResendVerification}
        isResendingVerification={false}
        resendCooldown={0}
      />
    );

    expect(screen.getByText('Email Unverified')).toBeInTheDocument();
    expect(screen.queryByText('Verified Reader')).not.toBeInTheDocument();
    expect(screen.getByText(/Please verify your email address/i)).toBeInTheDocument();

    const resendBtn = screen.getByRole('button', { name: 'Resend Verification Link' });
    fireEvent.click(resendBtn);
    expect(onResendVerification).toHaveBeenCalledTimes(1);
  });

  it('renders sending spinner and cooldown timer during resend verification states', () => {
    const { rerender } = render(
      <AccountIdentityCard
        user={mockUnverifiedUser}
        profile={null}
        formattedDate="February 2026"
        onResendVerification={vi.fn()}
        isResendingVerification={true}
        resendCooldown={0}
      />
    );
    expect(screen.getByText('Sending...')).toBeInTheDocument();

    rerender(
      <AccountIdentityCard
        user={mockUnverifiedUser}
        profile={null}
        formattedDate="February 2026"
        onResendVerification={vi.fn()}
        isResendingVerification={false}
        resendCooldown={45}
      />
    );
    expect(screen.getByText('Resend in 45s')).toBeInTheDocument();
  });

  it('displays resend error and resend success feedback banners', () => {
    render(
      <AccountIdentityCard
        user={mockUnverifiedUser}
        profile={mockProfile}
        formattedDate="January 2026"
        resendSuccess={true}
        resendError="Rate limit exceeded"
      />
    );

    expect(screen.getByText('Verification link sent! Check your inbox.')).toBeInTheDocument();
    expect(screen.getByText('Rate limit exceeded')).toBeInTheDocument();
  });

  it('renders muted streak badge when readingStreak is 0', () => {
    render(
      <AccountIdentityCard
        user={mockVerifiedUser}
        profile={mockProfile}
        formattedDate="January 2026"
        readingStreak={0}
      />
    );

    const streakBadge = screen.getByTestId('identity-streak-badge');
    expect(streakBadge).toBeInTheDocument();
    expect(streakBadge).toHaveClass('border-border', 'bg-muted/30', 'text-muted-foreground');
    expect(screen.getByText('🔥 0d Streak')).toBeInTheDocument();
  });

  it('falls back gracefully to 2-letter monogram initials across metadata, single-word, username, and BS defaults', () => {
    const userWithMeta = {
      ...mockVerifiedUser,
      user_metadata: { display_name: 'Scholar User' },
    };
    const { rerender } = render(
      <AccountIdentityCard
        user={userWithMeta}
        profile={null}
        formattedDate="January 2026"
      />
    );

    expect(screen.getByText('Scholar User')).toBeInTheDocument();
    expect(screen.getByTestId('identity-monogram-seal')).toHaveTextContent('SU');
    expect(screen.queryByText('Private Account')).not.toBeInTheDocument();

    // Single-word display name uses first two letters
    rerender(
      <AccountIdentityCard
        user={mockVerifiedUser}
        profile={{ ...mockProfile, display_name: 'Aristotle', username: 'aristotle' }}
        formattedDate="January 2026"
      />
    );
    expect(screen.getByTestId('identity-monogram-seal')).toHaveTextContent('AR');

    // Blank display name falls back to @username initials
    const minimalUser = {
      ...mockVerifiedUser,
      user_metadata: {},
    };
    rerender(
      <AccountIdentityCard
        user={minimalUser}
        profile={{ ...mockProfile, display_name: '   ', username: 'austen' }}
        formattedDate="January 2026"
      />
    );
    expect(screen.getByText('Reader')).toBeInTheDocument();
    expect(screen.getByTestId('identity-monogram-seal')).toHaveTextContent('AU');

    // When profile & metadata are empty, defaults to 'Reader' with 'BS' seal
    rerender(
      <AccountIdentityCard
        user={minimalUser}
        profile={null}
        formattedDate="January 2026"
      />
    );
    expect(screen.getByText('Reader')).toBeInTheDocument();
    expect(screen.getByTestId('identity-monogram-seal')).toHaveTextContent('BS');
  });

  it('renders Sign Out aligned to the right on narrow stacked rows alongside Streak and requires confirmation before invoking it', () => {
    const handleSignOut = vi.fn();
    render(
      <AccountIdentityCard
        user={mockVerifiedUser}
        profile={mockProfile}
        formattedDate="January 2026"
        readingStreak={3}
        onSignOut={handleSignOut}
      />
    );

    const actionsRow = screen.getByTestId('identity-actions-row');
    expect(actionsRow).toHaveClass('w-full', 'md:w-auto', 'justify-between', 'md:justify-end');

    const signOutBtn = screen.getByTestId('identity-sign-out-button');
    expect(signOutBtn).toBeInTheDocument();
    expect(signOutBtn).toHaveClass('ml-auto', 'md:ml-0');
    fireEvent.click(signOutBtn);

    const dialog = screen.getByTestId('identity-sign-out-dialog');
    expect(within(dialog).getByText(/Sign out from this browser\?/i)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByTestId('cancel-identity-sign-out-button'));
    expect(handleSignOut).not.toHaveBeenCalled();

    fireEvent.click(signOutBtn);
    fireEvent.click(screen.getByTestId('confirm-identity-sign-out-button'));
    expect(handleSignOut).toHaveBeenCalledTimes(1);
  });

  it('reveals inline Turnstile challenge before resending verification email when NEXT_PUBLIC_TURNSTILE_SITE_KEY is set', async () => {
    const prevKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = '0x4AAAAAAATestKey';

    let capturedOptions: {
      callback?: (token: string) => void;
      'error-callback'?: () => void;
    } = {};
    window.turnstile = {
      render: vi.fn((_el: HTMLElement, opts: typeof capturedOptions) => {
        capturedOptions = opts;
        return 'acct-verify-widget';
      }),
      reset: vi.fn(),
      remove: vi.fn(),
    };

    const onResendVerification = vi.fn().mockResolvedValue(undefined);

    try {
      render(
        <AccountIdentityCard
          user={mockUnverifiedUser}
          profile={null}
          formattedDate="February 2026"
          onResendVerification={onResendVerification}
        />
      );

      expect(screen.queryByTestId('resend-verification-turnstile-panel')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Resend Verification Link' }));
      expect(screen.getByTestId('resend-verification-turnstile-panel')).toBeInTheDocument();
      expect(screen.getByTestId('account-verify-turnstile-widget')).toBeInTheDocument();
      expect(onResendVerification).not.toHaveBeenCalled();

      act(() => {
        capturedOptions['error-callback']?.();
      });
      expect(
        await screen.findByText(/Security verification failed to load or verify/i)
      ).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByTestId('resend-verification-turnstile-panel')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Resend Verification Link' }));
      act(() => {
        capturedOptions.callback?.('account-verify-token-456');
      });
      await waitFor(() => {
        expect(onResendVerification).toHaveBeenCalledWith('account-verify-token-456');
      });
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
