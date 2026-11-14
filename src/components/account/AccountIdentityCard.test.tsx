import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
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

  it('renders slim scholar identity ribbon with inline clickable stat pills and toggles quick name editor', () => {
    const handleDisplayNameChange = vi.fn();
    const handleSaveProfile = vi.fn((e) => e.preventDefault());

    render(
      <AccountIdentityCard
        user={mockVerifiedUser}
        profile={mockProfile}
        formattedDate="January 2026"
        displayName="Test Reader"
        onDisplayNameChange={handleDisplayNameChange}
        onSaveProfile={handleSaveProfile}
        isSaving={false}
        saveSuccess={false}
        saveError={null}
        stats={{
          savedCount: 12,
          favoriteCount: 4,
          annotationCount: 9,
          customShelvesCount: 2,
          bookmarksCount: 3,
          readingStreak: 7,
        }}
      />
    );

    const ribbon = screen.getByTestId('scholar-identity-ribbon');
    expect(ribbon).toBeInTheDocument();
    expect(ribbon).toHaveClass('pt-4', 'sm:pt-5', 'px-4', 'sm:px-5', 'pb-1.5', 'sm:pb-2');
    expect(screen.getByText('Test Reader')).toBeInTheDocument();
    expect(screen.getByText('test_scholar')).toBeInTheDocument();
    expect(screen.queryByText('reader@bookarium.test')).not.toBeInTheDocument();
    expect(screen.getByText('Joined January 2026')).toBeInTheDocument();
    expect(screen.getByText('Verified Reader')).toBeInTheDocument();
    const statStrip = screen.getByTestId('identity-ribbon-stat-strip');
    expect(statStrip).toBeInTheDocument();
    expect(statStrip).toHaveClass('grid', 'grid-cols-5', 'divide-x', 'border-t', 'border-border', 'pt-2', 'sm:pt-2.5');
    expect(statStrip).not.toHaveClass('overflow-x-auto', 'border-border/70');
    const shelvedLink = screen.getByRole('link', { name: /Shelved/i });
    expect(shelvedLink).toHaveClass('py-0.5', 'sm:py-1');
    expect(screen.getByText('🔥 7d Streak')).toBeInTheDocument();
    expect(screen.getByTestId('identity-streak-badge')).toBeInTheDocument();

    // Open quick name editor
    const editBtn = screen.getByRole('button', {
      name: /Edit display name/i,
    });
    fireEvent.click(editBtn);

    const input = screen.getByLabelText('Display Name');
    fireEvent.change(input, { target: { value: 'Updated Reader' } });
    expect(handleDisplayNameChange).toHaveBeenCalledWith('Updated Reader');

    const saveBtn = screen.getByRole('button', { name: /Save Changes/i });
    fireEvent.click(saveBtn);
    expect(handleSaveProfile).toHaveBeenCalled();

    // Cancel button resets display name
    const cancelBtn = screen.getByRole('button', { name: /Cancel editing display name/i });
    fireEvent.click(cancelBtn);
    expect(handleDisplayNameChange).toHaveBeenCalledWith('Test Reader');
  });

  it('always renders a neutral 6th 🔥 0d Streak pill when readingStreak is 0 to prevent hydration CLS', () => {
    const onOpenLibraryBreakdown = vi.fn();

    render(
      <AccountIdentityCard
        user={mockVerifiedUser}
        profile={mockProfile}
        formattedDate="January 2026"
        displayName="Test Reader"
        onDisplayNameChange={vi.fn()}
        onSaveProfile={vi.fn()}
        isSaving={false}
        saveSuccess={false}
        saveError={null}
        stats={{
          savedCount: 0,
          favoriteCount: 0,
          annotationCount: 0,
          customShelvesCount: 0,
          bookmarksCount: 0,
          readingStreak: 0,
        }}
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
        displayName="New Reader"
        onDisplayNameChange={vi.fn()}
        onSaveProfile={vi.fn()}
        isSaving={false}
        saveSuccess={false}
        saveError={null}
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
        displayName="New Reader"
        onDisplayNameChange={vi.fn()}
        onSaveProfile={vi.fn()}
        isSaving={false}
        saveSuccess={false}
        saveError={null}
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
        displayName="New Reader"
        onDisplayNameChange={vi.fn()}
        onSaveProfile={vi.fn()}
        isSaving={false}
        saveSuccess={false}
        saveError={null}
        onResendVerification={vi.fn()}
        isResendingVerification={false}
        resendCooldown={45}
      />
    );
    expect(screen.getByText('Resend in 45s')).toBeInTheDocument();
  });

  it('displays save error and save success alert banners', () => {
    render(
      <AccountIdentityCard
        user={mockUnverifiedUser}
        profile={mockProfile}
        formattedDate="January 2026"
        displayName="Test Reader"
        onDisplayNameChange={vi.fn()}
        onSaveProfile={vi.fn()}
        isSaving={false}
        saveSuccess={true}
        saveError="Failed to save changes"
        resendSuccess={true}
        resendError="Rate limit exceeded"
      />
    );

    expect(screen.getByText('Failed to save changes')).toBeInTheDocument();
    expect(screen.getByText('Changes saved to cloud')).toBeInTheDocument();
    expect(screen.getByText('Verification link sent! Check your inbox.')).toBeInTheDocument();
    expect(screen.getByText('Rate limit exceeded')).toBeInTheDocument();
  });

  it('renders muted streak badge when readingStreak is 0', () => {
    render(
      <AccountIdentityCard
        user={mockVerifiedUser}
        profile={mockProfile}
        formattedDate="January 2026"
        displayName="Test Reader"
        onDisplayNameChange={vi.fn()}
        onSaveProfile={vi.fn()}
        isSaving={false}
        saveSuccess={false}
        saveError={null}
        stats={{
          savedCount: 1,
          favoriteCount: 0,
          annotationCount: 0,
          customShelvesCount: 0,
          bookmarksCount: 0,
          readingStreak: 0,
        }}
      />
    );

    const streakBadge = screen.getByTestId('identity-streak-badge');
    expect(streakBadge).toBeInTheDocument();
    expect(streakBadge).toHaveClass('border-border', 'bg-muted/30', 'text-muted-foreground');
    expect(screen.getByText('🔥 0d Streak')).toBeInTheDocument();
  });

  it('falls back gracefully to user_metadata display name or Scholar monogram S when name is missing', () => {
    const userWithMeta = {
      ...mockVerifiedUser,
      user_metadata: { display_name: 'Scholar User' },
    };
    const { rerender } = render(
      <AccountIdentityCard
        user={userWithMeta}
        profile={null}
        formattedDate="January 2026"
        displayName="Scholar User"
        onDisplayNameChange={vi.fn()}
        onSaveProfile={vi.fn()}
        isSaving={false}
        saveSuccess={false}
        saveError={null}
      />
    );

    expect(screen.getByText('Scholar User')).toBeInTheDocument();
    expect(screen.getByText('S')).toBeInTheDocument();

    // When both profile and metadata are empty, defaults to 'Reader' with monogram 'R'
    const minimalUser = {
      ...mockVerifiedUser,
      user_metadata: {},
    };
    rerender(
      <AccountIdentityCard
        user={minimalUser}
        profile={null}
        formattedDate="January 2026"
        displayName="Reader"
        onDisplayNameChange={vi.fn()}
        onSaveProfile={vi.fn()}
        isSaving={false}
        saveSuccess={false}
        saveError={null}
      />
    );
    expect(screen.getByText('Reader')).toBeInTheDocument();
    expect(screen.getByText('R')).toBeInTheDocument();
  });

  it('renders top-level Sign Out pill button when onSignOut is provided and invokes it on click', () => {
    const handleSignOut = vi.fn();
    render(
      <AccountIdentityCard
        user={mockVerifiedUser}
        profile={mockProfile}
        formattedDate="January 2026"
        displayName="Test Reader"
        onDisplayNameChange={vi.fn()}
        onSaveProfile={vi.fn()}
        isSaving={false}
        saveSuccess={false}
        saveError={null}
        onSignOut={handleSignOut}
      />
    );

    const signOutBtn = screen.getByTestId('identity-sign-out-button');
    expect(signOutBtn).toBeInTheDocument();
    fireEvent.click(signOutBtn);
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
          displayName="New Reader"
          onDisplayNameChange={vi.fn()}
          onSaveProfile={vi.fn()}
          isSaving={false}
          saveSuccess={false}
          saveError={null}
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
